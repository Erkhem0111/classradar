import * as vscode from "vscode";
import {
  type ErrorHelp,
  fetchHelp,
  markUnderstood,
  revealHint,
  sendHeartbeat,
  sendReport,
} from "./client";
import {
  HOVER_COMMANDS,
  OFFLINE,
  REVEAL_COMMAND,
  SHOW_TIP_COMMAND,
  SKELETON,
  UNDERSTOOD_COMMAND,
  renderHelp,
} from "./hover";
import {
  type StudentIdentity,
  SentTracker,
  buildReport,
  pickPrimaryError,
  reportKey,
} from "./payload";

// Errors are read only once the file is saved and untouched for this long, so
// half-typed code (autosave included) is never reported.
const QUIET_MS = 1000;
// Language servers often publish diagnostics a moment after the save, so a
// saved file stays "watched" this long after going quiet.
const WATCH_AFTER_SAVE_MS = QUIET_MS + 4000;
const SETTLE_MS = 300;
// A skeleton card turns into the real one if it arrives within this time.
const SKELETON_REFRESH_MS = 10000;

const readConfig = () => {
  const config = vscode.workspace.getConfiguration("classradar");
  return {
    enabled: config.get<boolean>("enabled", true),
    gatewayUrl: config.get<string>("gatewayUrl", "http://localhost:4000/graphql"),
    identity: {
      studentEmail: config.get<string>("studentEmail", "").trim(),
      classCode: config.get<string>("classCode", "").trim(),
      seat: config.get<string>("seat", "").trim(),
    } satisfies StudentIdentity,
  };
};

export const activate = (context: vscode.ExtensionContext) => {
  const log = vscode.window.createOutputChannel("Class Radar");
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  status.command = "classradar.pickSeat";
  const tracker = new SentTracker();
  // reportKey → server error id, so a hover can ask for that error's help.
  const sentIds = new Map<string, string>();
  const watched = new Map<string, number>();
  const timers = new Map<string, NodeJS.Timeout>();
  const lastEditAt = new Map<string, number>();
  // Files whose report is being sent right now.
  const sending = new Set<string>();
  // errorId → help, fetched right after reporting so hovers never wait.
  const helps = new Map<string, ErrorHelp>();
  // The error whose hover is showing a skeleton, to swap in the real card.
  let awaitingCard: { key: string; line: number; character: number; until: number } | null = null;
  let sentCount = 0;

  const showStatus = (state: "ok" | "offline" | "off") => {
    const { identity } = readConfig();
    const seat = `${identity.classCode} · ${identity.seat}`;
    if (state === "off") {
      status.text = "$(radio-tower) Радар унтраалттай";
    } else if (state === "offline") {
      status.text = `$(warning) Радар: холбогдсонгүй (${seat})`;
    } else {
      status.text = `$(radio-tower) Радар: ${sentCount} илгээсэн (${seat})`;
    }
    status.tooltip = "Class Radar — дарж суудлаа солино";
    status.show();
  };

  const reportFile = async (uri: vscode.Uri) => {
    const { enabled, gatewayUrl, identity } = readConfig();
    if (!enabled) return showStatus("off");
    if (!identity.studentEmail || !identity.classCode) {
      log.appendLine("Сурагчийн имэйл эсвэл ангийн код тохируулаагүй байна.");
      return;
    }

    const document = vscode.workspace.textDocuments.find(
      (doc) => doc.uri.toString() === uri.toString(),
    );
    // Edited again since the save: wait for the next save.
    if (!document || document.isDirty) return;
    const quietFor = Date.now() - (lastEditAt.get(uri.toString()) ?? 0);
    if (quietFor < QUIET_MS) return schedule(uri, QUIET_MS - quietFor);

    const file = vscode.workspace.asRelativePath(uri, false);
    const lines = Array.from({ length: document.lineCount }, (_, i) => document.lineAt(i).text);

    const primary = primaryError(uri);
    void sendHeartbeat(gatewayUrl, identity, Boolean(primary)).then((result) => {
      if (!result.ok) log.appendLine(`✗ heartbeat: ${result.error}`);
    });
    const reports = primary
      ? [buildReport(identity, { file, line: primary.line, message: primary.message }, lines)]
      : [];

    let offline = false;
    sending.add(uri.toString());
    for (const report of tracker.diff(file, reports)) {
      const result = await sendReport(gatewayUrl, report);
      if (result.ok) {
        sentCount += 1;
        const key = reportKey(report);
        sentIds.set(key, result.value._id);
        log.appendLine(
          `→ ${report.file}:${report.line} ${report.message}  [${result.value.normalizedKey}]`,
        );
        void loadHelp(result.value._id).then(() => swapSkeleton(key));
      } else {
        offline = true;
        tracker.forget(report);
        log.appendLine(`✗ ${report.file}:${report.line} илгээж чадсангүй: ${result.error}`);
      }
    }
    sending.delete(uri.toString());
    showStatus(offline ? "offline" : "ok");
  };

  function schedule(uri: vscode.Uri, delayMs = SETTLE_MS) {
    const key = uri.toString();
    clearTimeout(timers.get(key));
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        void reportFile(uri);
      }, delayMs),
    );
  }

  /** The first error in the file: the only one reported and explained. */
  function primaryError(uri: vscode.Uri) {
    return pickPrimaryError(
      vscode.languages
        .getDiagnostics(uri)
        .filter((diagnostic) => diagnostic.severity === vscode.DiagnosticSeverity.Error)
        // Position exposes line/character as getters, so they must be copied
        // explicitly; spreading it yields an empty object.
        .map(({ range, message }) => ({
          line: range.start.line,
          character: range.start.character,
          message,
        })),
    );
  }

  async function loadHelp(errorId: string) {
    const { gatewayUrl, identity } = readConfig();
    const result = await fetchHelp(gatewayUrl, errorId, identity.studentEmail);
    if (!result.ok) {
      log.appendLine(`✗ тайлбар авч чадсангүй: ${result.error}`);
      return undefined;
    }
    helps.set(errorId, result.value);
    return result.value;
  }

  /**
   * Local state changes first so the card reacts instantly; the server is
   * told in the background. Its answer never moves progress backwards, since
   * a later click may already be ahead of it.
   */
  const syncFromServer = (server: ErrorHelp) => {
    const local = helps.get(server.errorId);
    helps.set(server.errorId, {
      ...server,
      hintsUsed: Math.max(server.hintsUsed, local?.hintsUsed ?? 0),
      understood: server.understood || Boolean(local?.understood),
    });
  };

  const openNextTip = (help: ErrorHelp) => {
    if (help.hintsUsed >= help.hintsTotal) return;
    helps.set(help.errorId, { ...help, hintsUsed: help.hintsUsed + 1 });
    const { gatewayUrl, identity } = readConfig();
    void revealHint(gatewayUrl, help.errorId, identity.studentEmail).then((result) => {
      if (result.ok) {
        syncFromServer(result.value);
        log.appendLine(`💡 зөвлөгөө ${result.value.hintsUsed}/${result.value.hintsTotal}`);
      } else {
        log.appendLine(`✗ зөвлөгөө тэмдэглэж чадсангүй: ${result.error}`);
      }
    });
  };

  function swapSkeleton(key: string) {
    if (!awaitingCard || awaitingCard.key !== key) return;
    const { line, character, until } = awaitingCard;
    awaitingCard = null;
    if (Date.now() < until) void reopenHover(line, character);
  }

  // Which tip each error's hover shows; unset = the newest revealed one.
  const tipViews = new Map<string, number>();

  const markdown = (value: string) => {
    const md = new vscode.MarkdownString(value);
    md.supportHtml = true;
    md.isTrusted = { enabledCommands: HOVER_COMMANDS };
    return md;
  };

  // showHover opens at the cursor, so move it to the error first.
  const reopenHover = async (line: unknown, character: unknown) => {
    const editor = vscode.window.activeTextEditor;
    if (editor && typeof line === "number" && typeof character === "number") {
      const position = new vscode.Position(line, character);
      editor.selection = new vscode.Selection(position, position);
    }
    // showHover only focuses a hover that is already open instead of
    // re-rendering it, so close it first to make the card update in place.
    await vscode.commands.executeCommand("editor.action.hideHover");
    await vscode.commands.executeCommand("editor.action.showHover", { focus: "noAutoFocus" });
  };

  const hoverProvider: vscode.HoverProvider = {
    provideHover: async (document, position) => {
      const diagnostic = vscode.languages
        .getDiagnostics(document.uri)
        .find((d) => d.severity === vscode.DiagnosticSeverity.Error && d.range.contains(position));
      if (!diagnostic) return undefined;

      const { identity } = readConfig();
      const file = vscode.workspace.asRelativePath(document.uri, false);
      const report = buildReport(
        identity,
        { file, line: diagnostic.range.start.line, message: diagnostic.message },
        [],
      );
      const key = reportKey(report);
      const { start } = diagnostic.range;
      const errorId = sentIds.get(key);

      if (!errorId) {
        // Saved and on its way: show the card's skeleton, swapped for the real
        // card when it arrives. Any other error keeps just the editor's hover.
        const primary = primaryError(document.uri);
        const uri = document.uri.toString();
        const isPrimary = primary?.line === start.line && primary.character === start.character;
        if (!isPrimary || document.isDirty || !(timers.has(uri) || sending.has(uri))) {
          return undefined;
        }
        awaitingCard = {
          key,
          line: start.line,
          character: start.character,
          until: Date.now() + SKELETON_REFRESH_MS,
        };
        return new vscode.Hover(markdown(SKELETON), diagnostic.range);
      }

      const help = helps.get(errorId) ?? (await loadHelp(errorId));
      if (!help) return new vscode.Hover(markdown(OFFLINE), diagnostic.range);
      // The card always opens on tip 1, as in the design; seeing it counts.
      if (help.hintsUsed === 0) openNextTip(help);
      const current = helps.get(errorId) ?? help;
      const view = tipViews.get(errorId) ?? current.hintsUsed - 1;
      return new vscode.Hover(markdown(renderHelp(current, start, view)), diagnostic.range);
    },
  };

  context.subscriptions.push(
    log,
    vscode.languages.registerHoverProvider({ scheme: "file" }, hoverProvider),
    vscode.commands.registerCommand(
      REVEAL_COMMAND,
      async (errorId: unknown, line: unknown, character: unknown) => {
        const help = typeof errorId === "string" ? helps.get(errorId) : undefined;
        if (!help) return;
        openNextTip(help);
        tipViews.delete(help.errorId);
        await reopenHover(line, character);
      },
    ),
    vscode.commands.registerCommand(
      SHOW_TIP_COMMAND,
      async (errorId: unknown, index: unknown, line: unknown, character: unknown) => {
        if (typeof errorId !== "string" || typeof index !== "number") return;
        tipViews.set(errorId, index);
        await reopenHover(line, character);
      },
    ),
    vscode.commands.registerCommand(
      UNDERSTOOD_COMMAND,
      async (errorId: unknown, line: unknown, character: unknown) => {
        const help = typeof errorId === "string" ? helps.get(errorId) : undefined;
        if (!help) return;
        helps.set(help.errorId, { ...help, understood: true });
        await reopenHover(line, character);
        const { gatewayUrl, identity } = readConfig();
        const result = await markUnderstood(gatewayUrl, help.errorId, identity.studentEmail);
        if (result.ok) {
          syncFromServer(result.value);
          log.appendLine(`✓ ойлгосон, ${result.value.hintsUsed} зөвлөгөөгөөр`);
        } else {
          log.appendLine(`✗ "ойлголоо" илгээж чадсангүй: ${result.error}`);
        }
      },
    ),
    status,
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.contentChanges.length > 0)
        lastEditAt.set(event.document.uri.toString(), Date.now());
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (document.uri.scheme !== "file") return;
      watched.set(document.uri.toString(), Date.now() + WATCH_AFTER_SAVE_MS);
      schedule(document.uri);
    }),
    vscode.languages.onDidChangeDiagnostics((event) => {
      for (const uri of event.uris) {
        const until = watched.get(uri.toString());
        if (until && until > Date.now()) schedule(uri);
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("classradar")) showStatus(readConfig().enabled ? "ok" : "off");
    }),
    vscode.commands.registerCommand("classradar.showLog", () => log.show()),
    vscode.commands.registerCommand("classradar.pickSeat", async () => {
      const config = vscode.workspace.getConfiguration("classradar");
      const { identity } = readConfig();
      const studentEmail = await vscode.window.showInputBox({
        title: "Class Radar (1/3)",
        prompt: "Таны имэйл",
        value: identity.studentEmail,
      });
      if (studentEmail === undefined) return;
      const classCode = await vscode.window.showInputBox({
        title: "Class Radar (2/3)",
        prompt: "Ангийн код",
        value: identity.classCode,
      });
      if (classCode === undefined) return;
      const seat = await vscode.window.showInputBox({
        title: "Class Radar (3/3)",
        prompt: "Суудлын дугаар (жишээ нь С12)",
        value: identity.seat,
      });
      if (seat === undefined) return;
      const target = vscode.ConfigurationTarget.Global;
      await config.update("studentEmail", studentEmail.trim(), target);
      await config.update("classCode", classCode.trim(), target);
      await config.update("seat", seat.trim().toUpperCase(), target);
      showStatus("ok");
    }),
    { dispose: () => timers.forEach(clearTimeout) },
  );

  showStatus(readConfig().enabled ? "ok" : "off");
  log.appendLine(`Class Radar идэвхжлээ → ${readConfig().gatewayUrl}`);
};

export const deactivate = () => {};
