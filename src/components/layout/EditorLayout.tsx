import { Panel, Group, Separator } from 'react-resizable-panels';
import { PolicyEditor, InputEditor, ConfigEditor } from '@/components/editors';
import { OutputPanel } from '@/components/panels';

export function EditorLayout() {
  return (
    <div className="flex-1 min-h-0 p-4">
      <Group orientation="horizontal" className="h-full">
        <Panel defaultSize="50%" minSize="25%">
          <Group orientation="vertical" className="h-full">
            <Panel defaultSize="60%" minSize="20%">
              <PolicyEditor className="h-full" />
            </Panel>

            <Separator className="h-2 flex items-center justify-center group cursor-row-resize">
              <div className="w-12 h-1 rounded-full bg-[var(--color-border-light)] group-hover:bg-[var(--color-info)] transition-colors" />
            </Separator>

            <Panel defaultSize="40%" minSize="15%">
              <InputEditor className="h-full" />
            </Panel>
          </Group>
        </Panel>

        <Separator className="w-2 flex items-center justify-center group cursor-col-resize">
          <div className="h-12 w-1 rounded-full bg-[var(--color-border-light)] group-hover:bg-[var(--color-info)] transition-colors" />
        </Separator>

        <Panel defaultSize="50%" minSize="25%">
          <Group orientation="vertical" className="h-full">
            <Panel defaultSize="50%" minSize="15%">
              <ConfigEditor className="h-full" />
            </Panel>

            <Separator className="h-2 flex items-center justify-center group cursor-row-resize">
              <div className="w-12 h-1 rounded-full bg-[var(--color-border-light)] group-hover:bg-[var(--color-info)] transition-colors" />
            </Separator>

            <Panel defaultSize="50%" minSize="20%">
              <OutputPanel className="h-full" />
            </Panel>
          </Group>
        </Panel>
      </Group>
    </div>
  );
}
