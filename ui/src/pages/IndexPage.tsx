import { useQuery } from "@apollo/client";
import type { ComponentType, ReactNode } from "react";
import {
  IconBook,
  IconDatabase,
  IconExternalLink,
  IconLayoutDashboard,
  IconSandbox,
  IconSettings,
} from "@tabler/icons-react";
// Root imports on purpose: core-ui shares `erxes-ui`/`ui-modules` as Module
// Federation singletons keyed on the bare specifier, so deep imports would
// bundle second private copies instead of reusing the host's.
import { Badge, Breadcrumb, Button, Card, Separator, Skeleton, cn } from "erxes-ui";
import { PageHeader } from "ui-modules";
import { Link } from "react-router";
import manifest from "../../../erxes.json" with { type: "json" };
import { STATUS_QUERY } from "../graphql";

const { path } = manifest.ui;

const Dot = ({ className }: { className?: string }) => (
  <span
    className={cn("classradar:inline-block classradar:size-2 classradar:rounded-full", className)}
  />
);

const StatusRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="classradar:flex classradar:items-center classradar:justify-between classradar:gap-4 classradar:text-sm">
    <span className="classradar:text-muted-foreground">{label}</span>
    <span className="classradar:flex classradar:items-center classradar:gap-2 classradar:font-medium">
      {children}
    </span>
  </div>
);

const ConnectionCard = () => {
  const { data, loading, error, refetch } = useQuery(STATUS_QUERY);
  const status = data?.classradarStatus;

  const pending = (
    <>
      <Dot className="classradar:animate-pulse classradar:bg-muted-foreground" />
      <Skeleton className="classradar:h-4 classradar:w-24" />
    </>
  );

  return (
    <Card className="classradar:w-full classradar:md:w-80 classradar:shrink-0">
      <Card.Header>
        <Card.Title className="classradar:text-sm">Connection</Card.Title>
        <Card.Description>Live status of this plugin inside erxes</Card.Description>
      </Card.Header>
      <Card.Content className="classradar:flex classradar:flex-col classradar:gap-3">
        <StatusRow label="API">
          {loading ? (
            pending
          ) : error ? (
            <>
              <Dot className="classradar:bg-destructive" />
              <span>Unreachable</span>
              <Button variant="ghost" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </>
          ) : (
            <>
              <Dot className="classradar:bg-success" />
              <span>Connected · v{status?.version}</span>
            </>
          )}
        </StatusRow>
        <StatusRow label="Gateway">
          {loading ? (
            pending
          ) : error ? (
            <>
              <Dot className="classradar:bg-destructive" />
              <span className="classradar:truncate classradar:max-w-40" title={error.message}>
                {error.message}
              </span>
            </>
          ) : (
            <>
              <Dot className="classradar:bg-success" />
              <span>Federated as {status?.plugin}</span>
            </>
          )}
        </StatusRow>
        <StatusRow label="Tenant">{loading ? pending : (status?.subdomain ?? "—")}</StatusRow>
        <StatusRow label="Signed in">
          {loading
            ? pending
            : (status && (status.userEmail ?? status.userId ?? "Anonymous")) || "—"}
        </StatusRow>
      </Card.Content>
    </Card>
  );
};

const StepCard = ({
  icon: Icon,
  title,
  description,
  code,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  code: string;
}) => (
  <Card>
    <Card.Header>
      <div className="classradar:flex classradar:size-9 classradar:items-center classradar:justify-center classradar:rounded-lg classradar:bg-accent">
        <Icon className="classradar:size-5" />
      </div>
      <Card.Title>{title}</Card.Title>
      <Card.Description>{description}</Card.Description>
    </Card.Header>
    <Card.Content>
      <code className="classradar:rounded classradar:bg-muted classradar:px-1.5 classradar:py-0.5 classradar:font-mono classradar:text-xs">
        {code}
      </code>
    </Card.Content>
  </Card>
);

const STEPS = [
  {
    icon: IconDatabase,
    title: "Model your data",
    description: "Define the records this plugin owns and expose them on the federated graph.",
    code: "api/src/graphql/schema.ts",
  },
  {
    icon: IconLayoutDashboard,
    title: "Build the page",
    description:
      "Replace this overview with your module: lists with RecordTable, forms with Form, details in a Sheet.",
    code: "ui/src/pages/IndexPage.tsx",
  },
];

export const IndexPage = () => (
  <div className="classradar:flex classradar:h-full classradar:flex-col">
    <PageHeader>
      <PageHeader.Start>
        <Breadcrumb>
          <Breadcrumb.List className="classradar:gap-1">
            <Breadcrumb.Item>
              <Button variant="ghost" asChild>
                <Link to={`/${path}`}>
                  <IconSandbox />
                  {manifest.title}
                </Link>
              </Button>
            </Breadcrumb.Item>
          </Breadcrumb.List>
        </Breadcrumb>
        <Separator.Inline />
        <PageHeader.FavoriteToggleButton breadcrumb={[manifest.title]} icon="IconSandbox" />
      </PageHeader.Start>
      <PageHeader.End>
        <Button variant="outline" asChild>
          <Link to={`/${path}/settings`}>
            <IconSettings />
            Settings
          </Link>
        </Button>
      </PageHeader.End>
    </PageHeader>
    <div className="classradar:flex-1 classradar:overflow-auto">
      <div className="classradar:mx-auto classradar:flex classradar:w-full classradar:max-w-5xl classradar:flex-col classradar:gap-6 classradar:p-6">
        <section className="classradar:relative classradar:overflow-hidden classradar:rounded-xl classradar:border classradar:border-border classradar:bg-background classradar:p-8 classradar:shadow-xs">
          <div
            aria-hidden
            className="classradar:pointer-events-none classradar:absolute classradar:inset-0 classradar:bg-gradient-to-br classradar:from-primary/10 classradar:via-transparent classradar:to-transparent"
          />
          <div className="classradar:relative classradar:flex classradar:flex-col classradar:gap-6 classradar:md:flex-row classradar:md:items-start classradar:md:justify-between">
            <div className="classradar:flex classradar:max-w-xl classradar:flex-col classradar:gap-4">
              <div>
                <Badge variant="info">Plugin · v{manifest.version}</Badge>
              </div>
              <h1 className="classradar:text-2xl classradar:font-semibold classradar:tracking-tight">
                Welcome to {manifest.title}
              </h1>
              <p className="classradar:text-sm classradar:leading-relaxed classradar:text-muted-foreground">
                {manifest.description}
              </p>
              <div className="classradar:flex classradar:flex-wrap classradar:gap-2">
                <Button asChild>
                  <Link to={`/${path}/settings`}>
                    <IconSettings />
                    Open settings
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <a
                    href="https://erxes.io/docs/create-plugin-standalone"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <IconBook />
                    Developer guide
                    <IconExternalLink />
                  </a>
                </Button>
              </div>
            </div>
            <ConnectionCard />
          </div>
        </section>

        <div className="classradar:grid classradar:gap-4 classradar:md:grid-cols-2">
          {STEPS.map((step) => (
            <StepCard key={step.title} {...step} />
          ))}
        </div>
      </div>
    </div>
  </div>
);
