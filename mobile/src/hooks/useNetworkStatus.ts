import { useState, useEffect } from 'react';
import * as Network from 'expo-network';

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    async function checkNetwork() {
      try {
        const state = await Network.getNetworkStateAsync();
        if (mounted) {
          setIsConnected(state.isConnected ?? true);
          setIsInternetReachable(state.isInternetReachable ?? true);
        }
      } catch (err) {
        console.warn('[useNetworkStatus] Failed to read network state:', err);
      }
    }

    checkNetwork();
    const interval = setInterval(checkNetwork, 10000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return {
    isConnected,
    isInternetReachable,
    isOffline: !isConnected || !isInternetReachable,
  };
}
