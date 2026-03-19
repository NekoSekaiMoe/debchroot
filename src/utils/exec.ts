import * as exec from '@actions/exec';

export async function commandExists(command: string): Promise<boolean> {
  try {
    await exec.exec('which', [command], { silent: true });
    return true;
  } catch {
    return false;
  }
}

export async function execWithOutput(
  command: string,
  args?: string[],
  options?: exec.ExecOptions
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  let stdout = '';
  let stderr = '';

  const exitCode = await exec.exec(command, args, {
    ...options,
    listeners: {
      stdout: (data: Buffer) => {
        stdout += data.toString();
      },
      stderr: (data: Buffer) => {
        stderr += data.toString();
      }
    }
  });

  return { exitCode, stdout, stderr };
}