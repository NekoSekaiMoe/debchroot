import * as fs from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDebsh } from './debsh';
import * as exec from './exec';
import * as system from './system';

vi.mock('fs', async () => {
	const actual = await vi.importActual<typeof import('fs')>('fs');
	return {
		...actual,
		promises: {
			writeFile: vi.fn(),
			chmod: vi.fn(),
		},
	};
});

vi.mock('./exec');
vi.mock('./system');

describe('createDebsh', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Reset fs mock to resolved state by default
		vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
		vi.mocked(fs.promises.chmod).mockResolvedValue(undefined);
	});

	it('should create debsh script with correct content', async () => {
		vi.mocked(system.getSudo).mockResolvedValue('sudo');
		vi.mocked(exec.execWithOutput).mockResolvedValue({
			exitCode: 0,
			stdout: '',
			stderr: '',
		});

		const rootfs = '/home/user/rootfs';
		await createDebsh(rootfs);

		expect(fs.promises.writeFile).toHaveBeenCalledWith(
			'/tmp/debsh',
			expect.stringContaining(rootfs),
			{ mode: 0o755 }
		);

		const writtenContent = vi.mocked(fs.promises.writeFile).mock.calls[0][1] as string;
		expect(writtenContent).toContain('#!/usr/bin/env bash');
		expect(writtenContent).toContain('set -e');
		expect(writtenContent).toContain(`"$SU" chroot "${rootfs}" "$@"`);
	});

	it('should handle root user (no sudo needed)', async () => {
		vi.mocked(system.getSudo).mockResolvedValue('');
		vi.mocked(exec.execWithOutput).mockResolvedValue({
			exitCode: 0,
			stdout: '',
			stderr: '',
		});

		await createDebsh('/home/user/rootfs');

		expect(exec.execWithOutput).toHaveBeenCalledWith('mv', ['/tmp/debsh', '/usr/bin/debsh']);
		expect(exec.execWithOutput).toHaveBeenCalledWith('chmod', ['+x', '/usr/bin/debsh']);
		expect(exec.execWithOutput).not.toHaveBeenCalledWith('sudo', expect.any(Array));
	});

	it('should handle non-root user (with sudo)', async () => {
		vi.mocked(system.getSudo).mockResolvedValue('sudo');
		vi.mocked(exec.execWithOutput).mockResolvedValue({
			exitCode: 0,
			stdout: '',
			stderr: '',
		});

		await createDebsh('/home/user/rootfs');

		expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
			'mv',
			'/tmp/debsh',
			'/usr/bin/debsh',
		]);
		expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', ['chmod', '+x', '/usr/bin/debsh']);
	});

	it('should set correct file permissions on temp file', async () => {
		vi.mocked(system.getSudo).mockResolvedValue('sudo');
		vi.mocked(exec.execWithOutput).mockResolvedValue({
			exitCode: 0,
			stdout: '',
			stderr: '',
		});

		await createDebsh('/home/user/rootfs');

		expect(fs.promises.writeFile).toHaveBeenCalledWith('/tmp/debsh', expect.any(String), {
			mode: 0o755,
		});
	});

	it('should include proper bash script structure', async () => {
		vi.mocked(system.getSudo).mockResolvedValue('sudo');
		vi.mocked(exec.execWithOutput).mockResolvedValue({
			exitCode: 0,
			stdout: '',
			stderr: '',
		});

		await createDebsh('/home/user/rootfs');

		const writtenContent = vi.mocked(fs.promises.writeFile).mock.calls[0][1] as string;

		// Check script structure
		expect(writtenContent).toContain('if [ "$(id -u)" -eq 0 ]; then');
		expect(writtenContent).toContain('export SU=');
		expect(writtenContent).toContain('export SU=sudo');
		expect(writtenContent).toContain('fi');
	});

	it('should use correct target path', async () => {
		vi.mocked(system.getSudo).mockResolvedValue('sudo');
		vi.mocked(exec.execWithOutput).mockResolvedValue({
			exitCode: 0,
			stdout: '',
			stderr: '',
		});

		await createDebsh('/custom/path');

		expect(exec.execWithOutput).toHaveBeenCalledWith('sudo', [
			'mv',
			'/tmp/debsh',
			'/usr/bin/debsh',
		]);
	});

	it('should propagate errors from fs.writeFile', async () => {
		const writeError = new Error('Permission denied');
		vi.mocked(fs.promises.writeFile).mockRejectedValue(writeError);

		await expect(createDebsh('/home/user/rootfs')).rejects.toThrow('Permission denied');
	});

	it('should propagate errors from execWithOutput', async () => {
		vi.mocked(system.getSudo).mockResolvedValue('sudo');
		vi.mocked(exec.execWithOutput).mockRejectedValue(new Error('Command failed'));

		await expect(createDebsh('/home/user/rootfs')).rejects.toThrow('Command failed');
	});

	it('should handle different rootfs paths', async () => {
		vi.mocked(system.getSudo).mockResolvedValue('sudo');
		vi.mocked(exec.execWithOutput).mockResolvedValue({
			exitCode: 0,
			stdout: '',
			stderr: '',
		});

		await createDebsh('/var/lib/rootfs');

		const writtenContent = vi.mocked(fs.promises.writeFile).mock.calls[0][1] as string;
		expect(writtenContent).toContain('chroot "/var/lib/rootfs"');
	});
});
