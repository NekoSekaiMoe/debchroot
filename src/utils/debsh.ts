import * as fs from 'node:fs';
import { execWithOutput } from './exec';
import { getSudo } from './system';

export async function createDebsh(rootfs: string): Promise<void> {
	const debshContent = `#!/usr/bin/env bash
set -e

if [ "$(id -u)" -eq 0 ]; then
    export SU=
else
    export SU=sudo
fi

"$SU" chroot "${rootfs}" "$@"
`;

	const tmpPath = '/tmp/debsh';
	const targetPath = '/usr/bin/debsh';

	await fs.promises.writeFile(tmpPath, debshContent, { mode: 0o755 });

	const sudo = await getSudo();
	if (sudo) {
		await execWithOutput('sudo', ['mv', tmpPath, targetPath]);
		await execWithOutput('sudo', ['chmod', '+x', targetPath]);
	} else {
		await execWithOutput('mv', [tmpPath, targetPath]);
		await execWithOutput('chmod', ['+x', targetPath]);
	}
}
