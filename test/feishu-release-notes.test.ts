import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

describe('Feishu release notes pipeline', () => {
  const pythonTestTimeoutMs = 15_000
  const scriptPath = join(process.cwd(), '.github', 'scripts', 'feishu_release_notes.py')
  const workflowPath = join(process.cwd(), '.github', 'workflows', 'release.yml')

  const pythonEnv = { ...process.env, PYTHONIOENCODING: 'utf-8' }

  const fixtureRepos: string[] = []

  afterEach(() => {
    for (const dir of fixtureRepos.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  interface FixtureCommit {
    message: string
    date: string
    tag?: string | string[]
  }

  /** A throwaway git repo with a known commit + tag graph. */
  function buildTagFixtureRepo(commits: FixtureCommit[], annotated = false): string {
    const dir = mkdtempSync(join(tmpdir(), 'feishu-tags-'))
    fixtureRepos.push(dir)
    const git = (args: string[], extraEnv: Record<string, string> = {}): void => {
      execFileSync('git', args, {
        cwd: dir,
        env: {
          ...process.env,
          GIT_CONFIG_GLOBAL: '/dev/null',
          GIT_CONFIG_SYSTEM: '/dev/null',
          GIT_AUTHOR_NAME: 'Test',
          GIT_AUTHOR_EMAIL: 'test@example.com',
          GIT_COMMITTER_NAME: 'Test',
          GIT_COMMITTER_EMAIL: 'test@example.com',
          ...extraEnv
        }
      })
    }
    git(['init', '-q', '-b', 'main'])
    for (const { message, date, tag } of commits) {
      writeFileSync(join(dir, 'file.txt'), `${message}\n`)
      git(['add', '.'])
      git(['commit', '-q', '-m', message], { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date })
      const tags = Array.isArray(tag) ? tag : tag ? [tag] : []
      for (const name of tags) {
        git(annotated ? ['tag', '-a', name, '-m', `Release ${name}`] : ['tag', name], {
          GIT_COMMITTER_DATE: date
        })
      }
    }
    return dir
  }

  it(
    'builds a prompt with valid metadata and evidence blocks',
    () => {
      const output = execFileSync('python3', [scriptPath, 'build-prompt', '--tag', 'v0.4.0'], {
        encoding: 'utf8',
        env: pythonEnv
      })

      expect(output).toContain("You are DSH Desktop's Release Bot.")
      expect(output).toContain('## DSH Desktop v0.4.0 Release Note')
      expect(output).toContain('📢 大家可以直接在客户端中更新。')
      expect(output).toContain('📢 You can update directly from the DSH Desktop app.')
      expect(output).toContain('<tag-release-note>')
      expect(output).toContain('<commit-details>')
      expect(output).toContain('<diff-statistics>')
      expect(output).toContain('<code-diff>')
    },
    pythonTestTimeoutMs
  )

  it('generates deterministic fallback release notes that pass validation', () => {
    const tempFile = join(process.cwd(), '.temp-feishu-test-notes.md')
    try {
      execFileSync('python3', [scriptPath, 'generate-fallback', '--tag', 'v0.4.0', '--output', tempFile], {
        encoding: 'utf8',
        env: pythonEnv
      })

      const content = readFileSync(tempFile, 'utf8')
      expect(content).toContain('## DSH Desktop v0.4.0 Release Note')
      expect(content).toContain('📢 大家可以直接在客户端中更新。')
      expect(content).toContain('📢 You can update directly from the DSH Desktop app.')
      expect(content).toContain('---')

      // Validate passes without error
      const validateOutput = execFileSync('python3', [scriptPath, 'validate', '--tag', 'v0.4.0', '--input', tempFile], {
        encoding: 'utf8',
        env: pythonEnv
      })
      expect(validateOutput).toContain('validated successfully')
    } finally {
      try {
        unlinkSync(tempFile)
      } catch {}
    }
  })

  it('rejects invalid markdown with links or incorrect headings', () => {
    const tempFile = join(process.cwd(), '.temp-invalid-feishu-notes.md')
    try {
      // Invalid because it contains a link
      const invalidContent = `## DSH Desktop v0.4.0 Release Note

📢 大家可以直接在客户端中更新。

**🚀 1. 标题**

这是一个说明 [查看更多](https://example.com)。

---

## DSH Desktop v0.4.0 Release Note

📢 You can update directly from the DSH Desktop app.

**🚀 1. Title**

Description here.
`
      writeFileSync(tempFile, invalidContent, 'utf8')

      expect(() => {
        execFileSync('python3', [scriptPath, 'validate', '--tag', 'v0.4.0', '--input', tempFile], {
          encoding: 'utf8',
          stdio: 'pipe',
          env: pythonEnv
        })
      }).toThrow()
    } finally {
      try {
        unlinkSync(tempFile)
      } catch {}
    }
  })

  it('generates deterministic fallback prerelease notes that pass validation', () => {
    const tempFile = join(process.cwd(), '.temp-feishu-prerelease-test-notes.md')
    try {
      execFileSync(
        'python3',
        [scriptPath, 'generate-fallback', '--tag', '0.7.2', '--prerelease', '--output', tempFile],
        {
          encoding: 'utf8',
          env: pythonEnv
        }
      )

      const content = readFileSync(tempFile, 'utf8')
      expect(content).toContain('## DSH Desktop v0.7.2（预发布）Release Note')
      expect(content).toContain('⚠️ 本次为预发布版本，供测试与体验使用。')
      expect(content).toContain('⚠️ This is a pre-release version for testing and preview.')
      expect(content).toContain('---')

      // Validate passes without error with --prerelease flag
      const validateOutput = execFileSync(
        'python3',
        [scriptPath, 'validate', '--tag', '0.7.2', '--prerelease', '--input', tempFile],
        {
          encoding: 'utf8',
          env: pythonEnv
        }
      )
      expect(validateOutput).toContain('validated successfully')
    } finally {
      try {
        unlinkSync(tempFile)
      } catch {}
    }
  })

  it(
    'builds a prerelease prompt with previous tag and prerelease notices',
    () => {
      const repo = buildTagFixtureRepo([
        { message: 'stable work', date: '2026-02-01T00:00:00Z', tag: 'v0.7.1' },
        { message: 'prerelease cut', date: '2026-03-01T00:00:00Z', tag: ['0.7.2', 'v0.7.2'] }
      ], true)
      const output = execFileSync(
        'python3',
        [scriptPath, 'build-prompt', '--tag', '0.7.2', '--prerelease'],
        {
          encoding: 'utf8',
          env: pythonEnv,
          cwd: repo
        }
      )

      expect(output).toContain("user-facing pre-release copy")
      expect(output).toContain('## DSH Desktop v0.7.2（预发布）Release Note')
      expect(output).toContain('⚠️ 本次为预发布版本，供测试与体验使用。')
      expect(output).toContain('⚠️ This is a pre-release version for testing and preview.')
      expect(output).toContain('Previous tag: v0.7.1')
      expect(output).not.toContain('Previous tag: v0.7.2')
      expect(output).not.toContain('Previous tag: 0.7.2')
      expect(output).toContain('Verified range: v0.7.1..0.7.2')
      expect(output).toContain('Subject: prerelease cut')
      expect(output).toContain('+prerelease cut')
    },
    pythonTestTimeoutMs
  )

  it('differentiates previous tag resolution between prerelease and official release', () => {
    // A self-contained tag graph so this does not depend on which branch or
    // which fetched tags the checkout happens to carry:
    //   c0 (v0.7.0) -> c1 (v0.7.1) -> c2 (0.7.2, prerelease-style) -> c3 (HEAD, untagged)
    const repo = buildTagFixtureRepo([
      { message: 'base', date: '2026-01-01T00:00:00', tag: 'v0.7.0' },
      { message: 'stable work', date: '2026-02-01T00:00:00', tag: 'v0.7.1' },
      { message: 'prerelease cut', date: '2026-03-01T00:00:00', tag: '0.7.2' },
      { message: 'unreleased work', date: '2026-04-01T00:00:00' }
    ])
    const buildPrompt = (args: string[]): string =>
      execFileSync('python3', [scriptPath, 'build-prompt', ...args], {
        encoding: 'utf8',
        env: pythonEnv,
        cwd: repo
      })

    // Official v0.7.1: previous stable tag is v0.7.0.
    expect(buildPrompt(['--tag', 'v0.7.1'])).toContain('Previous stable tag: v0.7.0')

    // Prerelease 0.7.2: nearest tag of any kind before it is v0.7.1.
    expect(buildPrompt(['--tag', '0.7.2', '--prerelease'])).toContain('Previous tag: v0.7.1')

    // Future prerelease 0.8.0-rc.1 on HEAD: nearest tag is the 0.7.2 prerelease.
    expect(buildPrompt(['--tag', '0.8.0-rc.1', '--prerelease'])).toContain('Previous tag: 0.7.2')

    // Future official v0.8.0 on HEAD: must skip the 0.7.2 prerelease and pick v0.7.1.
    expect(buildPrompt(['--tag', 'v0.8.0'])).toContain('Previous stable tag: v0.7.1')
  })

  it.each(['lightweight', 'annotated'])('excludes all same-commit aliases for %s tags', (kind) => {
    const repo = buildTagFixtureRepo([
      { message: 'previous release', date: '2026-01-01T00:00:00Z', tag: 'v1.9.0' },
      { message: 'current release', date: '2026-02-01T00:00:00Z', tag: ['2.0.0', 'v2.0.0', 'v1.9.1'] }
    ], kind === 'annotated')
    const buildPrompt = (args: string[]): string =>
      execFileSync('python3', [scriptPath, 'build-prompt', ...args], {
        encoding: 'utf8',
        env: pythonEnv,
        cwd: repo
      })

    const prerelease = buildPrompt(['--tag', '2.0.0', '--prerelease'])
    expect(prerelease).toContain('Previous tag: v1.9.0')
    expect(prerelease).toContain('Verified range: v1.9.0..2.0.0')

    const stable = buildPrompt(['--tag', 'v2.0.0'])
    expect(stable).toContain('Previous stable tag: v1.9.0')
    expect(stable).toContain('Verified range: v1.9.0..v2.0.0')

    // An unpublished target falls back to HEAD, whose aliases still cannot bound a diff.
    const unpublished = buildPrompt(['--tag', '2.1.0-rc.1', '--prerelease'])
    expect(unpublished).toContain('Previous tag: v1.9.0')
    expect(unpublished).toContain('Verified range: v1.9.0..HEAD')
  })

  it.each([
    { scenario: 'no tags', tag: '0.1.0', prerelease: true, tags: [], previous: undefined },
    { scenario: 'root aliases', tag: '0.1.0', prerelease: true, tags: ['0.1.0', 'v0.1.0'], previous: undefined },
    { scenario: 'non-version history', tag: '0.1.0', prerelease: true, tags: ['0.1.0'], previous: 'preview-only' },
    { scenario: 'no stable history', tag: 'v0.1.0', prerelease: false, tags: ['0.1.0', 'v0.1.0'], previous: '0.0.1-rc.1' }
  ])('keeps Unavailable when there is no eligible predecessor: $scenario', ({ tag, prerelease, tags, previous }) => {
    const commits: FixtureCommit[] = []
    if (previous) commits.push({ message: 'earlier work', date: '2026-01-01T00:00:00Z', tag: previous })
    commits.push({ message: 'initial release', date: '2026-02-01T00:00:00Z', tag: tags })
    const repo = buildTagFixtureRepo(commits, true)
    const output = execFileSync('python3', [scriptPath, 'build-prompt', '--tag', tag, ...(prerelease ? ['--prerelease'] : [])], {
      encoding: 'utf8',
      env: pythonEnv,
      cwd: repo
    })

    expect(output).toContain(`${prerelease ? 'Previous tag' : 'Previous stable tag'}: Unavailable`)
    expect(output.split(/\r?\n/)).toContain(`- Verified range: ${tag}`)
    expect(output).toContain('Subject: initial release')
    expect(output).toContain('+initial release')
  })

  it('preserves creation-date ordering among eligible previous tags', () => {
    const repo = buildTagFixtureRepo([
      { message: 'earlier release', date: '2026-01-01T00:00:00Z', tag: 'v1.9.0' },
      { message: 'later maintenance release', date: '2026-02-01T00:00:00Z', tag: 'v1.8.1' },
      { message: 'current release', date: '2026-03-01T00:00:00Z', tag: 'v2.0.0' }
    ], true)
    const output = execFileSync('python3', [scriptPath, 'build-prompt', '--tag', 'v2.0.0'], {
      encoding: 'utf8',
      env: pythonEnv,
      cwd: repo
    })

    expect(output).toContain('Previous stable tag: v1.8.1')
    expect(output).toContain('Verified range: v1.8.1..v2.0.0')
  })

  it('integrates Feishu release notification into GitHub Actions workflow', () => {
    const workflow = readFileSync(workflowPath, 'utf8')
    expect(workflow).toContain('feishu_release_notes.py build-prompt')
    expect(workflow).toContain('feishu_release_notes.py validate')
    expect(workflow).toContain('feishu_release_notes.py send')
    expect(workflow).toContain('FEISHU_RELEASE_WEBHOOK')

    // Check publish-prerelease job has Feishu notification steps
    expect(workflow).toMatch(/publish-prerelease:[\s\S]*feishu_release_notes\.py build-prompt[\s\S]*--prerelease/)
    expect(workflow).toMatch(/publish-prerelease:[\s\S]*feishu_release_notes\.py validate[\s\S]*--prerelease/)
    expect(workflow).toMatch(/publish-prerelease:[\s\S]*feishu_release_notes\.py send[\s\S]*--prerelease/)
  })
})
