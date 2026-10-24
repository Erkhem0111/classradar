import * as vscode from "vscode";
import { sendReport } from "./client";
import { type StudentIdentity, SentTracker, buildReport } from "./payload";

// Language servers often publish diagnostics a moment after the save, so a
// saved file stays "watched" for this long and late diagnostics still count.
const WATCH_AFTER_SAVE_MS = 4000;
const SETTLE_MS = 800;

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
  const watched = new Map<string, number>();
  const timers = new Map<string, NodeJS.Timeout>();
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
    if (!document) return;
    const file = vscode.workspace.asRelativePath(uri, false);
    const lines = Array.from({ length: document.lineCount }, (_, i) => document.lineAt(i).text);

    const reports = vscode.languages
      .getDiagnostics(uri)
      .filter((diagnostic) => diagnostic.severity === vscode.DiagnosticSeverity.Error)
      .map((diagnostic) =>
        buildReport(
          identity,
          { file, line: diagnostic.range.start.line, message: diagnostic.message },
          lines,
        ),
      );

    let offline = false;
    for (const report of tracker.diff(file, reports)) {
      const result = await sendReport(gatewayUrl, report);
      if (result.ok) {
        sentCount += 1;
        log.appendLine(
          `→ ${report.file}:${report.line} ${report.message}  [${result.normalizedKey}]`,
        );
      } else {
        offline = true;
        tracker.forget(report);
        log.appendLine(`✗ ${report.file}:${report.line} илгээж чадсангүй: ${result.error}`);
      }
    }
    showStatus(offline ? "offline" : "ok");
  };

  const schedule = (uri: vscode.Uri) => {
    const key = uri.toString();
    clearTimeout(timers.get(key));
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        void reportFile(uri);
      }, SETTLE_MS),
    );
  };

  context.subscriptions.push(
    log,
    status,
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
        prompt: "Суудлын дугаар (жишээ нь A1)",
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
