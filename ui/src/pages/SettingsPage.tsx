import { useMutation, useQuery } from "@apollo/client";
import { IconBolt, IconRadar, IconRefresh, IconSettings } from "@tabler/icons-react";
import { Badge, Breadcrumb, Button, Card, Separator, Skeleton, Spinner } from "erxes-ui";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { PageHeader } from "ui-modules";
import manifest from "../../../erxes.json" with { type: "json" };
import { AI_STATUS_QUERY, PING_GEMMA_MUTATION } from "../graphql";
import { RadarTheme } from "./RadarDashboard";

const { path } = manifest.ui;

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="classradar:flex classradar:items-center classradar:justify-between classradar:gap-4 classradar:border-b classradar:border-border classradar:py-2.5 classradar:text-sm last:classradar:border-0">
    <span className="classradar:text-muted-foreground">{label}</span>
    <span className="classradar:font-medium">{children}</span>
  </div>
);

const AiCard = () => {
  const { data, loading, error, refetch } = useQuery(AI_STATUS_QUERY);
  const [ping, pinged] = useMutation(PING_GEMMA_MUTATION);
  const status = data?.classradarAiStatus;
  const result = pinged.data?.classradarPingGemma;

  return (
    <Card>
      <Card.Header>
        <Card.Title className="classradar:flex classradar:items-center classradar:gap-2">
          <IconBolt className="classradar:size-4 classradar:text-primary" /> Gemma 4 (AI)
        </Card.Title>
        <Card.Description>
          Алдааны монгол тайлбар, зөвлөгөө, ярилцлагын дүгнэлтийг үүсгэнэ. Сурагчийн код явахгүй,
          зөвхөн алдааны мессеж явна.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        {loading ? (
          <Skeleton className="classradar:h-32" />
        ) : error ? (
          <div className="classradar:flex classradar:items-center classradar:justify-between classradar:gap-3 classradar:text-sm classradar:text-destructive">
            {error.message}
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <IconRefresh /> Дахин
            </Button>
          </div>
        ) : (
          <div className="classradar:flex classradar:flex-col">
            <Row label="Төлөв">
              <Badge variant={status?.configured ? "success" : "warning"}>
                {status?.configured ? "Холбогдсон" : "Тохируулаагүй · бэлэн тайлбар"}
              </Badge>
            </Row>
            <Row label="Загвар">{status?.model ?? "—"}</Row>
            <Row label="Endpoint">{status?.endpoint ?? "—"}</Row>
            <Row label="Cache-лэгдсэн тайлбар">{status?.cachedExplanations ?? 0} төрөл</Row>
          </div>
        )}
      </Card.Content>
      <Card.Footer className="classradar:flex classradar:flex-col classradar:items-stretch classradar:gap-3">
        <Button
          onClick={() => ping().catch(() => undefined)}
          disabled={pinged.loading || !status?.configured}
        >
          {pinged.loading ? <Spinner size="sm" /> : <IconBolt />}
          {pinged.loading ? "Gemma бодож байна… (20–30с)" : "Gemma-г одоо шалгах"}
        </Button>
        {result && (
          <div className="classradar-rise classradar:rounded-lg classradar:border classradar:border-border classradar:p-3 classradar:text-sm">
            <div className="classradar:mb-1 classradar:flex classradar:items-center classradar:gap-2">
              <Badge variant={result.ok ? "success" : "destructive"}>
                {result.ok ? "Ажиллаж байна" : "Хариу ирсэнгүй"}
              </Badge>
              <span className="classradar:text-muted-foreground">
                {(result.ms / 1000).toFixed(1)} сек
              </span>
            </div>
            {result.ok && (
              <>
                <div className="classradar:font-semibold">{result.title}</div>
                <div className="classradar:text-muted-foreground">{result.explanation}</div>
              </>
            )}
          </div>
        )}
        {pinged.error && (
          <span className="classradar:text-sm classradar:text-destructive">
            {pinged.error.message}
          </span>
        )}
      </Card.Footer>
    </Card>
  );
};

const TodayCard = () => {
  const { data, loading } = useQuery(AI_STATUS_QUERY);
  const status = data?.classradarAiStatus;
  return (
    <Card>
      <Card.Header>
        <Card.Title>Өнөөдөр</Card.Title>
      </Card.Header>
      <Card.Content>
        {loading ? (
          <Skeleton className="classradar:h-16" />
        ) : (
          <div className="classradar:flex classradar:flex-col">
            <Row label="Бүртгэгдсэн алдаа">{status?.errorsToday ?? 0}</Row>
            <Row label="Сурагч">{status?.students ?? 0}</Row>
          </div>
        )}
      </Card.Content>
    </Card>
  );
};

const ExtensionCard = () => (
  <Card>
    <Card.Header>
      <Card.Title>VS Code extension холбох</Card.Title>
      <Card.Description>
        Сурагчийн VS Code-ийн тохиргоонд (Settings → Class Radar):
      </Card.Description>
    </Card.Header>
    <Card.Content className="classradar:flex classradar:flex-col">
      <Row label="classradar.gatewayUrl">
        <code className="classradar:font-mono classradar:text-xs">
          http://localhost:4000/graphql
        </code>
      </Row>
      <Row label="classradar.classCode">
        <code className="classradar:font-mono classradar:text-xs">10A</code>
      </Row>
      <Row label="classradar.seat">
        <code className="classradar:font-mono classradar:text-xs">С1 … С24</code>
      </Row>
      <Row label="Plugin">
        {manifest.name} · v{manifest.version}
      </Row>
    </Card.Content>
  </Card>
);

export const SettingsPage = () => (
  <div className="classradar:flex classradar:h-full classradar:flex-col">
    <PageHeader>
      <PageHeader.Start>
        <Breadcrumb>
          <Breadcrumb.List className="classradar:gap-1">
            <Breadcrumb.Item>
              <Button variant="ghost" asChild>
                <Link to={`/${path}/settings`}>
                  <IconSettings />
                  Тохиргоо
                </Link>
              </Button>
            </Breadcrumb.Item>
          </Breadcrumb.List>
        </Breadcrumb>
        <Separator.Inline />
      </PageHeader.Start>
      <PageHeader.End>
        <Button variant="outline" asChild>
          <Link to={`/${path}`}>
            <IconRadar />
            Ангийн радар
          </Link>
        </Button>
      </PageHeader.End>
    </PageHeader>
    <div className="classradar:min-h-0 classradar:flex-1 classradar:overflow-hidden">
      <RadarTheme>
        <div className="classradar:mx-auto classradar:flex classradar:w-full classradar:max-w-3xl classradar:flex-col classradar:gap-5 classradar:overflow-auto classradar:p-6">
          <AiCard />
          <TodayCard />
          <ExtensionCard />
        </div>
      </RadarTheme>
    </div>
  </div>
);
