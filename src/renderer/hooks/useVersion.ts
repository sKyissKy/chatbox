import { compareVersions } from 'compare-versions'
import dayjs from 'dayjs'
import { useAtomValue } from 'jotai'
import { useEffect, useMemo, useRef, useState } from 'react'
import { remoteConfigAtom } from '@/stores/atoms'
import { CHATBOX_BUILD_CHANNEL, CHATBOX_BUILD_PLATFORM } from '@/variables'
import * as remote from '../packages/remote'
import platform from '../platform'

function getInitialTime() {
  let initialTime = parseInt(localStorage.getItem('initial-time') || '')
  if (!initialTime) {
    initialTime = Date.now()
    localStorage.setItem('initial-time', `${initialTime}`)
  }

  return initialTime
}

export function isFirstDay(): boolean {
  const initialTime = getInitialTime()
  const today = dayjs()
  const installDay = dayjs(initialTime)

  // Compare only the date part (year, month, day) in user's local timezone
  // This ensures the comparison is based on the user's current timezone,
  // which is more intuitive for the user experience
  return today.isSame(installDay, 'day')
}

function isWin7Environment(): boolean {
  return (
    process.env.CHATBOX_WIN7_BUILD === 'true' ||
    (typeof navigator !== 'undefined' && /Windows NT 6\.1/i.test(navigator.userAgent))
  )
}

export default function useVersion() {
  const remoteConfig = useAtomValue(remoteConfigAtom)
  const [version, _setVersion] = useState('')
  const [needCheckUpdate, setNeedCheckUpdate] = useState(false)
  const isStoreReviewPlatform =
    CHATBOX_BUILD_PLATFORM === 'ios' ||
    (CHATBOX_BUILD_PLATFORM === 'android' && CHATBOX_BUILD_CHANNEL === 'google_play')
  const isExceeded = useMemo(
    () =>
      isStoreReviewPlatform &&
      Date.now() - getInitialTime() < 24 * 3600 * 1000 &&
      version &&
      remoteConfig.current_version &&
      compareVersions(version, remoteConfig.current_version) === 1,
    [version, remoteConfig]
  )
  const updateCheckTimer = useRef<NodeJS.Timeout>()
  useEffect(() => {
    const isWin7 = isWin7Environment()
    const handler = async () => {
      const config = await platform.getConfig()
      const settings = await platform.getSettings()
      const version = await platform.getVersion()
      _setVersion(version)
      if (isWin7 || !settings?.autoUpdate) {
        return
      }
      try {
        const os = await platform.getPlatform()
        const needUpdate = await remote.checkNeedUpdate(version, os, config, settings)
        setNeedCheckUpdate(needUpdate)
      } catch (e) {
        console.debug('Failed to check for updates:', e)
      }
    }
    handler()
    if (!isWin7) {
      updateCheckTimer.current = setInterval(handler, 2 * 60 * 60 * 1000)
    }
    return () => {
      if (updateCheckTimer.current) {
        clearInterval(updateCheckTimer.current)
        updateCheckTimer.current = undefined
      }
    }
  }, [])

  // True when all async data needed to evaluate isExceeded has loaded.
  // On non-store platforms this is always true (no defense to evaluate).
  // On store platforms we must wait for both version AND remoteConfig.current_version
  // before the guide-navigation guard in __root.tsx can make a reliable decision.
  const isExceededResolved = isStoreReviewPlatform ? !!(version && remoteConfig.current_version) : true

  return {
    version,
    versionLoaded: !!version,
    isExceeded,
    isExceededResolved,
    needCheckUpdate,
  }
}
