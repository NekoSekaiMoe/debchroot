import { describe, it, expect, vi, beforeEach } from 'vitest';
import { commandExists, execWithOutput } from './exec';
import * as exec from '@actions/exec';

vi.mock('@actions/exec');

describe('commandExists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true when command exists', async () => {
    vi.mocked(exec.exec).mockResolvedValue(0);

    const result = await commandExists('git');

    expect(result).toBe(true);
    expect(exec.exec).toHaveBeenCalledWith('which', ['git'], { silent: true });
  });

  it('should return false when command does not exist', async () => {
    vi.mocked(exec.exec).mockRejectedValue(new Error('Command not found'));

    const result = await commandExists('nonexistent');

    expect(result).toBe(false);
  });

  it('should return false when exec throws', async () => {
    vi.mocked(exec.exec).mockImplementation(() => {
      throw new Error('Some error');
    });

    const result = await commandExists('git');

    expect(result).toBe(false);
  });
});

describe('execWithOutput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return exitCode, stdout and stderr on success', async () => {
    vi.mocked(exec.exec).mockImplementation(async (command, args, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from('output line 1\n'));
        options.listeners.stdout(Buffer.from('output line 2'));
      }
      if (options?.listeners?.stderr) {
        options.listeners.stderr(Buffer.from('error line\n'));
      }
      return 0;
    });

    const result = await execWithOutput('echo', ['hello']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('output line 1\noutput line 2');
    expect(result.stderr).toBe('error line\n');
  });

  it('should return non-zero exitCode on failure', async () => {
    vi.mocked(exec.exec).mockImplementation(async (command, args, options) => {
      if (options?.listeners?.stdout) {
        options.listeners.stdout(Buffer.from(''));
      }
      if (options?.listeners?.stderr) {
        options.listeners.stderr(Buffer.from('error message'));
      }
      return 1;
    });

    const result = await execWithOutput('false');

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe('error message');
  });

  it('should pass options to exec', async () => {
    vi.mocked(exec.exec).mockResolvedValue(0);

    await execWithOutput('git', ['status'], { cwd: '/tmp', silent: true });

    expect(exec.exec).toHaveBeenCalledWith(
      'git',
      ['status'],
      expect.objectContaining({
        cwd: '/tmp',
        silent: true,
        listeners: expect.objectContaining({
          stdout: expect.any(Function),
          stderr: expect.any(Function),
        }),
      })
    );
  });

  it('should handle empty stdout and stderr', async () => {
    vi.mocked(exec.exec).mockResolvedValue(0);

    const result = await execWithOutput('true');

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
  });
});
