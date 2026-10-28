import type { SkillMetadata } from '@shared/types/skills'
import * as browserAutomation from './browser-automation'
import * as chatboxProductInfo from './chatbox-product-info'
import * as dataAnalysis from './data-analysis'
import * as frontendDesign from './frontend-design'
import * as generativeUi from './generative-ui'
import * as mlBestPractices from './ml-best-practices'
import * as multimediaTools from './multimedia-tools'
import * as officeAutomation from './office-automation'
import * as offlineAgentStation from './offline-agent-station'
import * as reverseEngineering from './reverse-engineering'
import * as skillCreator from './skill-creator'
import * as taskAutomation from './task-automation'
import * as vibedrop from './vibedrop'

/**
 * BuiltinSeed: 随客户端打包的官方内置 skill 种子，用作首启种子与离线 fallback。
 * 运行时这些种子会被写入本地快照目录（userData/builtin-skills），
 * 之后由 builtin-sync 从后端拉取更新并覆盖快照。
 */
export interface BuiltinSeed {
  metadata: SkillMetadata
  body: string
  version: number
}

export const builtinSkills: BuiltinSeed[] = [
  { metadata: dataAnalysis.metadata, body: dataAnalysis.body, version: 2 },
  { metadata: officeAutomation.metadata, body: officeAutomation.body, version: 1 },
  { metadata: browserAutomation.metadata, body: browserAutomation.body, version: 1 },
  { metadata: multimediaTools.metadata, body: multimediaTools.body, version: 1 },
  { metadata: offlineAgentStation.metadata, body: offlineAgentStation.body, version: 1 },
  { metadata: generativeUi.metadata, body: generativeUi.body, version: 1 },
  { metadata: mlBestPractices.metadata, body: mlBestPractices.body, version: 1 },
  { metadata: taskAutomation.metadata, body: taskAutomation.body, version: 1 },
  { metadata: skillCreator.metadata, body: skillCreator.body, version: 1 },
  { metadata: chatboxProductInfo.metadata, body: chatboxProductInfo.body, version: 4 },
  { metadata: reverseEngineering.metadata, body: reverseEngineering.body, version: 1 },
  { metadata: vibedrop.metadata, body: vibedrop.body, version: 1 },
  { metadata: frontendDesign.metadata, body: frontendDesign.body, version: 1 },
]
