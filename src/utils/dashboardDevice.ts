import { Platform } from "react-native";

interface DashboardDevice {
  id: string;
  name: string;
}

let dashboardDevice: DashboardDevice | undefined;

const compact = (parts: Array<string | false>) => parts.filter(Boolean).join(" ");
const labelValue = (value: unknown): string => value == null ? "" : String(value).trim();
const stableHash = (value: string): string => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};
const deviceModel = (): string => {
  if (Platform.OS === "android") return compact([Platform.constants.Manufacturer, Platform.constants.Model]);
  if (Platform.OS === "ios") return Platform.constants.interfaceIdiom;
  return "";
};
const osVersion = () => labelValue(Platform.OS === "android" ? Platform.constants.Release : Platform.Version);
const platformName = () => {
  if (Platform.OS === "android") return "Android";
  if (Platform.OS === "ios") return labelValue(Platform.constants.systemName);
  return labelValue(Platform.OS);
};
const deviceName = (): string => {
  const version = osVersion();
  const details = compact([platformName(), version, deviceModel()]);
  return details || "Device";
};

export const getDashboardDevice = (): DashboardDevice => {
  if (!dashboardDevice) {
    const name = deviceName();
    dashboardDevice = {
      id: `rn-${Platform.OS}-${stableHash(name)}`,
      name,
    };
  }

  return dashboardDevice;
};

export const withDashboardDevice = (url: string): string => {
  const device = getDashboardDevice();
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}deviceId=${encodeURIComponent(device.id)}&deviceName=${encodeURIComponent(device.name)}`;
};
