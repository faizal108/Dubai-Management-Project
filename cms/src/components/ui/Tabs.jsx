import React from "react";
import { Tab } from "@headlessui/react";
import { cn } from "./cn";

/**
 * Themed tabs wrapper around Headless UI's Tab.
 * Usage:
 *   <Tabs tabs={[{ key, label, content }]} />
 * or as compound: <Tabs.Group><Tabs.List>…</Tabs.List><Tabs.Panels>…</Tabs.Panels></Tabs.Group>
 */
export function TabsList({ className, children, ...rest }) {
  return (
    <Tab.List
      className={cn(
        "flex items-center gap-1 border-b border-border",
        className
      )}
      {...rest}
    >
      {children}
    </Tab.List>
  );
}

export function TabItem({ children, className, ...rest }) {
  return (
    <Tab
      className={({ selected }) =>
        cn(
          "border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none",
          selected
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground",
          typeof className === "function" ? className({ selected }) : className
        )
      }
      {...rest}
    >
      {children}
    </Tab>
  );
}

export function TabPanels({ className, children, ...rest }) {
  return (
    <Tab.Panels className={cn("pt-4", className)} {...rest}>
      {children}
    </Tab.Panels>
  );
}

export function TabPanel({ className, children, ...rest }) {
  return (
    <Tab.Panel
      className={cn("focus-visible:outline-none", className)}
      {...rest}
    >
      {children}
    </Tab.Panel>
  );
}

export default function Tabs({ tabs = [], defaultIndex = 0, onChange }) {
  return (
    <Tab.Group defaultIndex={defaultIndex} onChange={onChange}>
      <TabsList>
        {tabs.map((t) => (
          <TabItem key={t.key}>{t.label}</TabItem>
        ))}
      </TabsList>
      <TabPanels>
        {tabs.map((t) => (
          <TabPanel key={t.key}>{t.content}</TabPanel>
        ))}
      </TabPanels>
    </Tab.Group>
  );
}

Tabs.Group = Tab.Group;
Tabs.List = TabsList;
Tabs.Item = TabItem;
Tabs.Panels = TabPanels;
Tabs.Panel = TabPanel;
