'use client';

import * as React from 'react';
import { cn } from './cn.js';

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext(component: string): TabsContextValue {
  const ctx = React.useContext(TabsContext);
  if (!ctx) {
    throw new Error(`<${component}> must be used within <Tabs>`);
  }
  return ctx;
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Controlled active tab value. */
  value?: string;
  /** Initial active tab value for uncontrolled usage. */
  defaultValue?: string;
  /** Called when the active tab changes. */
  onValueChange?: (value: string) => void;
}

export function Tabs({
  value: controlledValue,
  defaultValue,
  onValueChange,
  className,
  children,
  ...props
}: TabsProps) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue ?? '');
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolled;

  const setValue = React.useCallback(
    (next: string) => {
      if (!isControlled) setUncontrolled(next);
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  const ctx = React.useMemo<TabsContextValue>(() => ({ value, setValue }), [value, setValue]);

  return (
    <TabsContext.Provider value={ctx}>
      <div className={cn('flex flex-col gap-3', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}
Tabs.displayName = 'Tabs';

export type TabListProps = React.HTMLAttributes<HTMLDivElement>;

export function TabList({ className, ...props }: TabListProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1',
        className,
      )}
      {...props}
    />
  );
}
TabList.displayName = 'TabList';

export interface TabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Value identifying this tab; must match a TabPanel value. */
  value: string;
}

export function Tab({ value, className, ...props }: TabProps) {
  const { value: active, setValue } = useTabsContext('Tab');
  const selected = active === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={() => setValue(value)}
      className={cn(
        'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400',
        selected
          ? 'bg-indigo-600 text-white'
          : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900',
        className,
      )}
      {...props}
    />
  );
}
Tab.displayName = 'Tab';

export interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Value identifying this panel; must match a Tab value. */
  value: string;
}

export function TabPanel({ value, className, children, ...props }: TabPanelProps) {
  const { value: active } = useTabsContext('TabPanel');
  if (active !== value) return null;
  return (
    <div role="tabpanel" className={cn('text-slate-700', className)} {...props}>
      {children}
    </div>
  );
}
TabPanel.displayName = 'TabPanel';
