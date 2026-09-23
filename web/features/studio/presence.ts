import { useEffect, useRef, useState } from 'react';

export type PresencePoint = [number, number, number];
export type PresenceCamera = { position: PresencePoint; target: PresencePoint };
export type PresencePeer = {
  id: string;
  name: string;
  role: string;
  cursor: PresencePoint | null;
  camera: PresenceCamera | null;
};

export function useStudioPresence(
  project: string,
  version: string,
  share: string,
  enabled: boolean,
  camera: React.RefObject<PresenceCamera>,
  invite = '',
) {
  const [visible, setVisible] = useState(true);
  const [peers, setPeers] = useState<PresencePeer[]>([]);
  const [connected, setConnected] = useState(false);
  const cursor = useRef<PresencePoint | null>(null);

  useEffect(() => {
    if (!enabled || !visible || !project || !version) {
      return;
    }
    const query = new URLSearchParams({ version });
    if (share) query.set('share', share);
    else {
      query.set('project', project);
      if (invite) query.set('invite', invite);
    }
    const url = `/api/studio/presence?${query}`;
    let stopped = false;
    let timer = 0;
    let session: { id: string; secret: string } | null = null;
    let lastPayload = '';
    let lastSent = 0;

    const leave = () => {
      if (!session) return;
      void fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(session),
        keepalive: true,
      }).catch(() => {});
      session = null;
    };
    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState !== 'visible') {
        leave();
        setPeers([]);
        setConnected(false);
        timer = window.setTimeout(tick, 1000);
        return;
      }
      const payload = JSON.stringify({ cursor: cursor.current, camera: camera.current });
      try {
        const heartbeat = !session || payload !== lastPayload || Date.now() - lastSent >= 3000;
        const response = heartbeat
          ? await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...session, ...JSON.parse(payload) }),
            })
          : await fetch(`${url}&id=${encodeURIComponent(session!.id)}`);
        if (!response.ok) throw new Error(String(response.status));
        const data = await response.json() as { id?: string; secret?: string; peers: PresencePeer[] };
        if (stopped) return;
        if (heartbeat && data.id && data.secret) {
          session = { id: data.id, secret: data.secret };
          lastPayload = payload;
          lastSent = Date.now();
        }
        setPeers((previous) => JSON.stringify(previous) === JSON.stringify(data.peers) ? previous : data.peers);
        setConnected(true);
      } catch {
        if (stopped) return;
        leave();
        setPeers([]);
        setConnected(false);
        timer = window.setTimeout(tick, 3000);
        return;
      }
      timer = window.setTimeout(tick, 500);
    };
    void tick();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      leave();
      setPeers([]);
      setConnected(false);
    };
  }, [project, version, share, invite, enabled, visible, camera]);

  return { visible, setVisible, connected: enabled && visible && connected, peers: enabled && visible && project && version ? peers : [], cursor };
}
