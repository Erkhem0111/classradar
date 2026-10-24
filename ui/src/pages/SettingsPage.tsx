import { IconAdjustments, IconSandbox, IconSettings } from "@tabler/icons-react";
import { Breadcrumb, Button, Card, Empty, Separator } from "erxes-ui";
import { PageHeader } from "ui-modules";
import { Link } from "react-router";
import manifest from "../../../erxes.json" with { type: "json" };

const { path } = manifest.ui;

const IDENTITY: [string, string][] = [
  ["Name", manifest.name],
  ["Route", `/${path}`],
  ["Remote", manifest.ui.remote],
  ["API", `:${manifest.api.port}${manifest.api.graphql}`],
  ["Version", manifest.version],
];

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
                  {manifest.title} settings
                </Link>
              </Button>
            </Breadcrumb.Item>
          </Breadcrumb.List>
        </Breadcrumb>
        <Separator.Inline />
        <PageHeader.FavoriteToggleButton
          breadcrumb={[manifest.title, "settings"]}
          icon="IconSettings"
        />
      </PageHeader.Start>
      <PageHeader.End>
        <Button variant="outline" asChild>
          <Link to={`/${path}`}>
            <IconSandbox />
            Back to {manifest.title}
          </Link>
        </Button>
      </PageHeader.End>
    </PageHeader>
    <div className="classradar:flex-1 classradar:overflow-auto">
      <div className="classradar:mx-auto classradar:flex classradar:w-full classradar:max-w-3xl classradar:flex-col classradar:gap-6 classradar:p-6">
        <Card>
          <Card.Header>
            <Card.Title>General</Card.Title>
            <Card.Description>
              Plugin identity comes from erxes.json; change it there and restart.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <dl className="classradar:grid classradar:grid-cols-[8rem_1fr] classradar:gap-y-2 classradar:text-sm">
              {IDENTITY.map(([label, value]) => (
                <div key={label} className="classradar:contents">
                  <dt className="classradar:text-muted-foreground">{label}</dt>
                  <dd>
                    <code className="classradar:rounded classradar:bg-muted classradar:px-1.5 classradar:py-0.5 classradar:font-mono classradar:text-xs">
                      {value}
                    </code>
                  </dd>
                </div>
              ))}
            </dl>
          </Card.Content>
        </Card>
        <Card>
          <Card.Header>
            <Card.Title>Your settings</Card.Title>
            <Card.Description>
              Add this plugin's own configuration here: forms with Form from erxes-ui, saved through
              a prefixed mutation.
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <Empty>
              <Empty.Header>
                <Empty.Media variant="icon">
                  <IconAdjustments />
                </Empty.Media>
                <Empty.Title>No settings yet</Empty.Title>
                <Empty.Description>
                  Edit ui/src/pages/SettingsPage.tsx to add them.
                </Empty.Description>
              </Empty.Header>
            </Empty>
          </Card.Content>
        </Card>
      </div>
    </div>
  </div>
);
