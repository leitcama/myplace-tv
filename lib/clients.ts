import { ClientConfig, ClientProfile } from '@/types/resolver';

// YouTube client configurations for different platforms
export const CLIENT_CONFIGS: Record<ClientProfile, ClientConfig> = {
  WEB: {
    name: 'WEB',
    version: '2.20231219.01.00',
    platform: 'DESKTOP',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    innertubeApiKey: 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
    innertubeContext: {
      client: {
        clientName: 'WEB',
        clientVersion: '2.20231219.01.00',
        platform: 'DESKTOP',
        clientFormFactor: 'UNKNOWN_FORM_FACTOR',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        timeZone: 'America/New_York',
        browserName: 'Chrome',
        browserVersion: '120.0.0.0',
        osName: 'Windows',
        osVersion: '10.0',
        screenWidthPoints: 1920,
        screenHeightPoints: 1080,
        screenPixelDensity: 1,
        utcOffsetMinutes: -300,
        userInterfaceTheme: 'USER_INTERFACE_THEME_DARK',
        connectionType: 'CONN_CELLULAR_4G',
        memoryTotalKbytes: '8000000',
        mainAppWebInfo: {
          graftUrl: 'https://www.youtube.com/',
          webDisplayMode: 'WEB_DISPLAY_MODE_BROWSER',
          isWebNativeShareEnabled: false,
        },
      },
      user: {
        lockedSafetyMode: false,
      },
      request: {
        useSsl: true,
        internalExperimentFlags: [],
        consistencyTokenJars: [],
      },
    },
  },
  
  ANDROID: {
    name: 'ANDROID',
    version: '19.12.34',
    platform: 'MOBILE',
    userAgent: 'com.google.android.youtube/19.12.34 (Linux; U; Android 11; en_US; Pixel 5 Build/RQ3A.210805.001.A1) gzip',
    innertubeApiKey: 'AIzaSyA8eiZmM1FaDVjRy-d5Joapq4k9PvWJU3g',
    innertubeContext: {
      client: {
        clientName: 'ANDROID',
        clientVersion: '19.12.34',
        platform: 'MOBILE',
        clientFormFactor: 'PHONE',
        userAgent: 'com.google.android.youtube/19.12.34 (Linux; U; Android 11; en_US; Pixel 5 Build/RQ3A.210805.001.A1) gzip',
        timeZone: 'America/New_York',
        browserName: 'Android',
        browserVersion: '11',
        osName: 'Android',
        osVersion: '11',
        screenWidthPoints: 1080,
        screenHeightPoints: 2400,
        screenPixelDensity: 2.75,
        utcOffsetMinutes: -300,
        userInterfaceTheme: 'USER_INTERFACE_THEME_DARK',
        connectionType: 'CONN_WIFI',
        memoryTotalKbytes: '6000000',
        mainAppWebInfo: {
          graftUrl: 'https://m.youtube.com/',
          webDisplayMode: 'WEB_DISPLAY_MODE_STANDALONE',
          isWebNativeShareEnabled: true,
        },
      },
      user: {
        lockedSafetyMode: false,
      },
      request: {
        useSsl: true,
        internalExperimentFlags: [],
        consistencyTokenJars: [],
      },
    },
  },
  
  TV: {
    name: 'TVHTML5',
    version: '1.20231219.01.00',
    platform: 'TV',
    userAgent: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 7.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    innertubeApiKey: 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
    innertubeContext: {
      client: {
        clientName: 'TVHTML5',
        clientVersion: '1.20231219.01.00',
        platform: 'TV',
        clientFormFactor: 'TV',
        userAgent: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 7.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        timeZone: 'America/New_York',
        browserName: 'Chrome',
        browserVersion: '120.0.0.0',
        osName: 'Tizen',
        osVersion: '7.0',
        screenWidthPoints: 1920,
        screenHeightPoints: 1080,
        screenPixelDensity: 1,
        utcOffsetMinutes: -300,
        userInterfaceTheme: 'USER_INTERFACE_THEME_DARK',
        connectionType: 'CONN_WIFI',
        memoryTotalKbytes: '4000000',
        mainAppWebInfo: {
          graftUrl: 'https://www.youtube.com/tv',
          webDisplayMode: 'WEB_DISPLAY_MODE_STANDALONE',
          isWebNativeShareEnabled: false,
        },
      },
      user: {
        lockedSafetyMode: false,
      },
      request: {
        useSsl: true,
        internalExperimentFlags: [],
        consistencyTokenJars: [],
      },
    },
  },
  
  IOS: {
    name: 'IOS',
    version: '19.12.34',
    platform: 'MOBILE',
    userAgent: 'com.google.ios.youtube/19.12.34 (iPhone; iOS 17.0; Scale/3.00)',
    innertubeApiKey: 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
    innertubeContext: {
      client: {
        clientName: 'IOS',
        clientVersion: '19.12.34',
        platform: 'MOBILE',
        clientFormFactor: 'PHONE',
        userAgent: 'com.google.ios.youtube/19.12.34 (iPhone; iOS 17.0; Scale/3.00)',
        timeZone: 'America/New_York',
        browserName: 'Safari',
        browserVersion: '17.0',
        osName: 'iOS',
        osVersion: '17.0',
        screenWidthPoints: 1170,
        screenHeightPoints: 2532,
        screenPixelDensity: 3,
        utcOffsetMinutes: -300,
        userInterfaceTheme: 'USER_INTERFACE_THEME_DARK',
        connectionType: 'CONN_WIFI',
        memoryTotalKbytes: '6000000',
        mainAppWebInfo: {
          graftUrl: 'https://m.youtube.com/',
          webDisplayMode: 'WEB_DISPLAY_MODE_STANDALONE',
          isWebNativeShareEnabled: true,
        },
      },
      user: {
        lockedSafetyMode: false,
      },
      request: {
        useSsl: true,
        internalExperimentFlags: [],
        consistencyTokenJars: [],
      },
    },
  },
};

// Get client configuration for a profile
export function getClientConfig(profile: ClientProfile): ClientConfig {
  if (!CLIENT_CONFIGS[profile]) {
    // Fallback to WEB if invalid profile
    return CLIENT_CONFIGS.WEB;
  }
  return CLIENT_CONFIGS[profile];
}

// Get default client profile based on user agent
export function getDefaultClientProfile(userAgent?: string): ClientProfile {
  if (!userAgent) return 'WEB';
  
  const ua = userAgent.toLowerCase();
  
  if (ua.includes('android')) return 'ANDROID';
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'IOS';
  if (ua.includes('smart-tv') || ua.includes('tizen') || ua.includes('webos')) return 'TV';
  
  return 'WEB';
}

// Regional detection helpers
export function detectRegion(headers: Record<string, string | undefined>): string {
  // Check for Cloudflare headers
  const cfCountry = headers['cf-ipcountry'];
  if (cfCountry) return cfCountry;
  
  // Check for other common headers
  const xForwardedFor = headers['x-forwarded-for'];
  if (xForwardedFor) {
    // Extract first IP and use geo-location (simplified)
    const firstIp = xForwardedFor.split(',')[0].trim();
    // In production, you'd use a geo-IP service here
    return 'US'; // Default fallback
  }
  
  return 'US'; // Default
}

// Get optimal client profile for region
export function getOptimalClientProfile(region: string, userAgent?: string): ClientProfile {
  // Some regions work better with specific clients
  const regionalPreferences: Record<string, ClientProfile> = {
    'CN': 'ANDROID', // China often works better with mobile clients
    'RU': 'ANDROID', // Russia sometimes has issues with web client
    'IN': 'ANDROID', // India often prefers mobile clients
  };
  
  const regional = regionalPreferences[region];
  if (regional) return regional;
  
  return getDefaultClientProfile(userAgent);
}