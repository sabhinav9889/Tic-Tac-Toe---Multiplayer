import { Client } from '@heroiclabs/nakama-js';
import type { Session, Socket } from '@heroiclabs/nakama-js';

const useSSL = import.meta.env.VITE_NAKAMA_USE_SSL === 'true';
const host = import.meta.env.VITE_NAKAMA_HOST || "127.0.0.1";
const port = import.meta.env.VITE_NAKAMA_PORT || "7350";

export const nakamaClient = new Client("defaultkey", host, port, useSSL);
export let nakamaSession: Session | null = null;
export let nakamaSocket: Socket | null = null;

export const authenticate = async (): Promise<Session> => {
    let deviceId = localStorage.getItem("device_id");
    if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem("device_id", deviceId);
    }

    nakamaSession = await nakamaClient.authenticateDevice(deviceId, true, deviceId.substring(0, 8));
    nakamaSocket = nakamaClient.createSocket(useSSL, false);
    await nakamaSocket.connect(nakamaSession, true);
    return nakamaSession;
};
