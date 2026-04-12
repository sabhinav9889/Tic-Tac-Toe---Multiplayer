import { Client } from '@heroiclabs/nakama-js';
import type { Session, Socket } from '@heroiclabs/nakama-js';

const useSSL = false;
export const nakamaClient = new Client("defaultkey", "127.0.0.1", "7350", useSSL);
export let nakamaSession: Session | null = null;
export let nakamaSocket: Socket | null = null;

export const authenticate = async (): Promise<Session> => {
    let deviceId = localStorage.getItem("device_id");
    if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem("device_id", deviceId);
    }

    // We'll use the deviceId as the username for simplicity in testing
    nakamaSession = await nakamaClient.authenticateDevice(deviceId, true, deviceId.substring(0, 8));
    nakamaSocket = nakamaClient.createSocket(useSSL, false);
    await nakamaSocket.connect(nakamaSession, true);
    return nakamaSession;
};
