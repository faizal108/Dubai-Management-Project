import React from "react";
import {
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Button,
  Badge,
  Input,
  FormField,
  cn,
} from "../../../components/ui";
import { useTheme, THEME_MODES, ACCENTS } from "../../../context/ThemeContext";

// Visual metadata for each mode tile.
const MODE_META = {
  light: { label: "Light", icon: SunIcon, hint: "Bright, daytime-friendly" },
  dark: { label: "Dark", icon: MoonIcon, hint: "Easy on the eyes at night" },
  system: {
    label: "System",
    icon: ComputerDesktopIcon,
    hint: "Match your device setting",
  },
};

// Static swatches so the accent grid renders the actual color even when not
// applied. These mirror the `--primary` values defined in index.css.
const ACCENT_META = {
  indigo: { label: "Indigo", swatch: "bg-[hsl(238,84%,60%)]" },
  emerald: { label: "Emerald", swatch: "bg-[hsl(160,68%,40%)]" },
  rose: { label: "Rose", swatch: "bg-[hsl(346,84%,55%)]" },
  amber: { label: "Amber", swatch: "bg-[hsl(35,92%,50%)]" },
  slate: { label: "Slate", swatch: "bg-[hsl(215,25%,40%)]" },
};

export default function AppearanceSettings() {
  const { mode, accent, resolvedMode, setMode, setAccent } = useTheme();

  return (
    <div className="flex flex-col gap-6">
      {/* Appearance — Mode */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Choose a light or dark theme, or let it follow your operating
            system. Currently resolved:{" "}
            <Badge variant="primary" size="sm">
              {resolvedMode}
            </Badge>
          </CardDescription>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {THEME_MODES.map((m) => {
              const meta = MODE_META[m];
              const Icon = meta.icon;
              const active = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  aria-pressed={active}
                  className={cn(
                    "group flex flex-col items-start gap-2 rounded-lg border bg-background p-4 text-left transition-all",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    active
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border hover:border-primary/40 hover:bg-muted/40"
                  )}
                >
                  <span className="flex w-full items-center justify-between">
                    <span
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-md",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground group-hover:text-foreground"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    {active && <CheckIcon className="h-4 w-4 text-primary" />}
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {meta.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {meta.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Accent picker */}
      <Card>
        <CardHeader>
          <CardTitle>Accent color</CardTitle>
          <CardDescription>
            Pick the primary color used for buttons, links, and highlights.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <div className="flex flex-wrap gap-3">
            {ACCENTS.map((a) => {
              const meta = ACCENT_META[a];
              const active = accent === a;
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAccent(a)}
                  aria-pressed={active}
                  title={meta.label}
                  className={cn(
                    "group flex flex-col items-center gap-2 rounded-lg border bg-background p-3 transition-all",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    active
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  <span
                    className={cn(
                      "relative flex h-10 w-10 items-center justify-center rounded-full shadow-soft",
                      meta.swatch
                    )}
                  >
                    {active && <CheckIcon className="h-5 w-5 text-white" />}
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    {meta.label}
                  </span>
                </button>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Live preview */}
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            A quick look at how primitives respond to your selection.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Buttons
              </p>
              <div className="flex flex-wrap gap-2">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Danger</Button>
              </div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Badges
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="primary">Primary</Badge>
                <Badge variant="success">Success</Badge>
                <Badge variant="warning">Warning</Badge>
                <Badge variant="danger">Danger</Badge>
                <Badge variant="outline">Outline</Badge>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <FormField label="Sample input" hint="Try focusing this field.">
                <Input placeholder="Type something…" />
              </FormField>
              <FormField
                label="With error state"
                error="This field is required."
              >
                <Input defaultValue="" placeholder="Required" />
              </FormField>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
