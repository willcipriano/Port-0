import { useState, type ReactNode } from 'react';
import type { WinState } from '../hooks/useWindowManager';
import { APP_REGISTRY } from '../apps/registry';
import { TOOL_REGISTRY, type ToolRegistryKey } from '../tools/registry';
import { buildToolMenuTree, type ToolMenuNode } from '../tools/menuTree';

interface StartMenuProps {
  windows: WinState[];
  displayHandle: string;
  balance: number;
  connected: boolean;
  onOpen: (id: string) => void;
  onFocus: (id: string) => void;
  onLaunchTool: (key: ToolRegistryKey) => void;
  onCloseMenu: () => void;
  onLogout: () => void;
}

const SYSTEM_APPS_DESCRIPTION = 'Core uplink windows — navigation, sessions, rig monitor';
const TOOLZ_DESCRIPTION = 'Deploy tools in dedicated windows — trace risk applies after START';

function pad(depth: number): number {
  return 14 + depth * 14;
}

export function MenuEntry({
  icon,
  title,
  description,
  isActive = false,
  dimmed = false,
  depth = 0,
  onClick,
}: {
  icon?: string;
  title: string;
  description?: string;
  isActive?: boolean;
  dimmed?: boolean;
  depth?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="menu-entry"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '7px 8px',
        paddingLeft: `${pad(depth)}px`,
        background: isActive ? 'rgba(0,229,255,0.06)' : 'transparent',
        border: '1px solid transparent',
        borderRadius: '2px',
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
        fontFamily: 'var(--font-mono)',
      }}
    >
      {icon && (
        <span style={{
          width: '36px',
          fontSize: '9px',
          color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)',
          fontWeight: 700,
          letterSpacing: '0.05em',
          flexShrink: 0,
          textShadow: isActive ? 'var(--glow-cyan)' : 'none',
        }}>
          {icon}
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '11px',
          color: dimmed
            ? 'var(--text-dim)'
            : isActive ? 'var(--text-bright)' : 'var(--text-primary)',
          fontWeight: isActive ? 600 : 400,
          letterSpacing: '0.08em',
        }}>
          {title}
        </div>
        {description && (
          <div style={{
            fontSize: '9px',
            color: 'var(--text-dim)',
            letterSpacing: '0.04em',
            marginTop: '1px',
          }}>
            {description}
          </div>
        )}
      </div>
      {isActive && (
        <div style={{
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          background: 'var(--accent-cyan)',
          boxShadow: 'var(--glow-cyan)',
          flexShrink: 0,
        }} />
      )}
    </button>
  );
}

export function MenuBranch({
  label,
  description,
  depth = 0,
  defaultExpanded = false,
  children,
}: {
  label: string;
  description?: string;
  depth?: number;
  defaultExpanded?: boolean;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div>
      <button
        type="button"
        className="menu-branch"
        onClick={() => setExpanded(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '8px',
          width: '100%',
          textAlign: 'left',
          padding: '8px 10px',
          paddingLeft: `${pad(depth)}px`,
          background: expanded ? 'rgba(0,229,255,0.06)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: depth === 0 ? '11px' : '10px',
            color: 'var(--accent-cyan)',
            letterSpacing: '0.1em',
            fontWeight: 700,
          }}>
            {label}
          </div>
          {description && (
            <div style={{
              fontSize: '9px',
              color: 'var(--text-dim)',
              letterSpacing: '0.04em',
              marginTop: '2px',
              lineHeight: 1.4,
            }}>
              {description}
            </div>
          )}
        </div>
        <span style={{
          fontSize: '8px',
          opacity: 0.7,
          color: 'var(--accent-cyan)',
          flexShrink: 0,
          marginTop: '2px',
        }}>
          {expanded ? '▾' : '▸'}
        </span>
      </button>
      {expanded && (
        <div
          className="menu-branch-children"
          style={depth > 0 ? {
            borderLeft: '1px solid var(--border)44',
            marginLeft: `${pad(depth)}px`,
          } : undefined}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function ToolMenuNodes({
  nodes,
  depth,
  connected,
  onLaunchTool,
  onCloseMenu,
}: {
  nodes: ToolMenuNode[];
  depth: number;
  connected: boolean;
  onLaunchTool: (key: ToolRegistryKey) => void;
  onCloseMenu: () => void;
}) {
  return (
    <>
      {nodes.map(node => {
        if (node.toolKey) {
          const def = TOOL_REGISTRY[node.toolKey];
          return (
            <MenuEntry
              key={node.toolKey}
              depth={depth}
              icon={def.icon}
              title={def.label}
              description={def.description}
              dimmed={!connected}
              onClick={() => {
                onLaunchTool(node.toolKey!);
                onCloseMenu();
              }}
            />
          );
        }
        return (
          <MenuBranch key={node.label} label={node.label} depth={depth}>
            <ToolMenuNodes
              nodes={node.children ?? []}
              depth={depth + 1}
              connected={connected}
              onLaunchTool={onLaunchTool}
              onCloseMenu={onCloseMenu}
            />
          </MenuBranch>
        );
      })}
    </>
  );
}

export function StartMenu({
  windows,
  displayHandle,
  balance,
  connected,
  onOpen,
  onFocus,
  onLaunchTool,
  onCloseMenu,
  onLogout,
}: StartMenuProps) {
  const toolTree = buildToolMenuTree();

  return (
    <div
      className="menu-panel"
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '320px',
        background: 'rgba(8,12,18,0.97)',
        border: '1px solid var(--border-bright)',
        borderBottom: 'none',
        borderRadius: '4px 4px 0 0',
        pointerEvents: 'all',
        animation: 'slide-in-left 0.15s ease',
        boxShadow: '0 -4px 32px rgba(0,229,255,0.1)',
        overflow: 'visible',
        maxHeight: 'calc(100vh - 80px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div className="menu-panel-header" style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: 'var(--bg-panel-3)',
        flexShrink: 0,
        position: 'relative',
      }}>
        <div style={{
          width: '28px',
          height: '28px',
          background: 'rgba(0,229,255,0.1)',
          border: '1px solid var(--accent-cyan)44',
          borderRadius: '2px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '10px',
          color: 'var(--accent-cyan)',
          textShadow: 'var(--glow-cyan)',
          fontWeight: 700,
        }}>
          P:0
        </div>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontWeight: 700, letterSpacing: '0.1em' }}>
            {displayHandle || 'OPERATOR'}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
            ₿{balance.toLocaleString()} · ACTIVE
          </div>
        </div>
      </div>

      <div style={{ padding: '4px 4px 8px', overflowY: 'auto', flex: 1 }}>
        <MenuBranch label="System Apps" description={SYSTEM_APPS_DESCRIPTION} depth={0}>
          {APP_REGISTRY.map(app => {
            const win = windows.find(w => w.id === app.id);
            const isOpen = win && !win.closed && !win.minimized;
            return (
              <MenuEntry
                key={app.id}
                depth={1}
                icon={app.icon}
                title={app.title}
                description={app.description}
                isActive={Boolean(isOpen)}
                onClick={() => {
                  if (win) {
                    if (win.closed || win.minimized) onOpen(app.id);
                    else onFocus(app.id);
                  } else {
                    onOpen(app.id);
                  }
                  onCloseMenu();
                }}
              />
            );
          })}
        </MenuBranch>

        <MenuBranch label="Toolz" description={TOOLZ_DESCRIPTION} depth={0}>
          <ToolMenuNodes
            nodes={toolTree}
            depth={1}
            connected={connected}
            onLaunchTool={onLaunchTool}
            onCloseMenu={onCloseMenu}
          />
        </MenuBranch>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', padding: '6px 8px', flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => { onCloseMenu(); onLogout(); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 8px',
            width: '100%',
            textAlign: 'left',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'var(--accent-red)',
            letterSpacing: '0.12em',
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,34,68,0.08)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <span style={{ textShadow: 'var(--glow-red)' }}>✕</span>
          DISCONNECT SESSION
        </button>
      </div>
    </div>
  );
}
