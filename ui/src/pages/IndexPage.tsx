import { IconRadar, IconSettings } from "@tabler/icons-react";
// Root imports on purpose: core-ui shares `erxes-ui`/`ui-modules` as Module
// Federation singletons keyed on the bare specifier, so deep imports would
// bundle second private copies instead of reusing the host's.
import { Breadcrumb, Button, Separator } from "erxes-ui";
import { PageHeader } from "ui-modules";
import { Link } from "react-router";
import manifest from "../../../erxes.json" with { type: "json" };
import { RadarDashboard } from "./RadarDashboard";

const { path } = manifest.ui;

export const IndexPage = () => (
  <div className="classradar:flex classradar:h-full classradar:flex-col">
    <PageHeader>
      <PageHeader.Start>
        <Breadcrumb>
          <Breadcrumb.List className="classradar:gap-1">
            <Breadcrumb.Item>
              <Button variant="ghost" asChild>
                <Link to={`/${path}`}>
                  <IconRadar />
                  Ангийн радар
                </Link>
              </Button>
            </Breadcrumb.Item>
          </Breadcrumb.List>
        </Breadcrumb>
        <Separator.Inline />
        <PageHeader.FavoriteToggleButton breadcrumb={[manifest.title]} icon="IconRadar" />
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
    <div className="classradar:min-h-0 classradar:flex-1 classradar:overflow-hidden">
      <RadarDashboard />
    </div>
  </div>
);
