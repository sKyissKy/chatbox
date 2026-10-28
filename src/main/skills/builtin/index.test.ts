import { describe, expect, it } from 'vitest'
import { builtinSkills } from './index'

describe('builtinSkills', () => {
  it('only includes practical built-in skills', () => {
    expect(builtinSkills.map((item) => item.metadata.name)).toEqual([
      'data-analysis',
      'office-automation',
      'browser-automation',
      'multimedia-tools',
      'offline-agent-station',
      'generative-ui',
      'ml-best-practices',
      'task-automation',
      'skill-creator',
      'chatbox-product-info',
      'reverse-engineering',
      'vibedrop',
      'frontend-design',
    ])
  })

  it('includes reverse engineering skill', () => {
    const skill = builtinSkills.find((item) => item.metadata.name === 'reverse-engineering')

    expect(skill).toBeDefined()
    expect(skill?.metadata.description).toContain('Reverse Engineer Anything (REA)')
    expect(skill?.body).toContain('Electron & Web Applications')
    expect(skill?.body).toContain('Native Win32/x64 PE Binaries')
  })

  it('includes Chatbox product information skill', () => {
    const skill = builtinSkills.find((item) => item.metadata.name === 'chatbox-product-info')

    expect(skill).toBeDefined()
    expect(skill?.metadata.description).toContain('pricing')
    expect(skill?.body).toContain('https://chatboxai.app/llms.txt')
    expect(skill?.body).toContain('https://chatboxai.app/pricing.md')
    expect(skill?.body).toContain('["settings", "get", "<key>"]')
    expect(skill?.body).not.toContain('["settings", "set"')
    expect(skill?.body).toContain('guide the user to change it manually')
    expect(skill?.body).toContain('["chats", "read", "<session-id>"]')
    expect(skill?.body).toContain('automated user-role notification')
  })

  it('keeps data analysis aligned with the offline Python and Node harness', () => {
    const skill = builtinSkills.find((item) => item.metadata.name === 'data-analysis')

    expect(skill).toBeDefined()
    expect(skill?.body).toContain('code_execution')
    expect(skill?.body).toContain('Python 3.8 toolchain')
    expect(skill?.body).toContain('create_download')
  })

  it('includes VibeDrop static hosting skill', () => {
    const skill = builtinSkills.find((item) => item.metadata.name === 'vibedrop')

    expect(skill).toBeDefined()
    expect(skill?.metadata.description).toContain('Deploy any static site')
    expect(skill?.body).toContain('vibedrop deploy ./dist')
    expect(skill?.body).toContain('https://app.vibedrop.cc/claim')
  })
})
