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
) {
  const [visible, setVisible] = useState(true);
  const [peers, setPeers] = useState<PresencePeer[]>([]);
  const cursor = useRef<PresencePoint | null>(null);

  useEffect(() => {
    if (!enabled || !visible || !project || !version) {
      setPeers([]);
      return;
    }
    const query = new URLSearchParams({ version });
    if (share) query.set('share', share);
    else query.set('project', project);
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
        setPeers(data.peers);
      } catch {
        if (stopped) return;
        session = null;
        setPeers([]);
      }
      timer = window.setTimeout(tick, 500);
    };
    void tick();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      leave();
      setPeers([]);
    };
  }, [project, version, share, enabled, visible, camera]);

  return { visible, setVisible, peers, cursor };
}
