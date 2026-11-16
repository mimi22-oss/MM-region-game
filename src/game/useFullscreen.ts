import { useState, useEffect, useCallback } from 'react';
import {
  getFullscreenState,
  subscribeFullscreen,
  toggleFullscreen as toggleFullscreenAction,
  requestFullscreen as requestFullscreenAction,
  exitFullscreen as exitFullscreenAction,
  type FullscreenState,
} from './fullscreenManager';

export function useFullscreen() {
  const [state, setState] = useState<FullscreenState>(() => getFullscreenState());

  useEffect(() => {
    return subscribeFullscreen((nextState) => {
      setState(nextState);
    });
  }, []);

  const toggle = useCallback(() => {
    return toggleFullscreenAction();
  }, []);

  const request = useCallback(() => {
    return requestFullscreenAction();
  }, []);

  const exit = useCallback(() => {
    return exitFullscreenAction();
  }, []);

  return {
    isSupported: state.supported,
    isFullscreen: state.active,
    isStandalone: state.standalone,
    toggleFullscreen: toggle,
    requestFullscreen: request,
    exitFullscreen: exit,
  };
}
