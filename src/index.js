#!/usr/bin/env node

import { ANT, ArweaveSigner } from '@ar.io/sdk';
import fs from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import Irys from '@irys/sdk';

import TurboDeploy from './turbo';

const argv = yargs(hideBin(process.argv))
	.option('ant-process', {
		alias: 'a',
		type: 'string',
		description: 'The ANT process',
		demandOption: true,
	})
	.option('deploy-folder', {
		alias: 'd',
		type: 'string',
		description: 'Folder to deploy.',
		default: './dist',
	})
	.option('undername', {
		alias: 'u',
		type: 'string',
		description: 'ANT undername to update.',
		default: '@',
	})
	.option('turbo', {
		alias: 't',
		type: 'boolean',
		description: 'Enable upload with Turbo',
		default: false,
	}).argv;

const DEPLOY_KEY = process.env.DEPLOY_KEY;
const ANT_PROCESS = argv.antProcess;

export function getTagValue(list, name) {
	for (let i = 0; i < list.length; i++) {
		if (list[i]) {
			if (list[i].name === name) {
				return list[i].value;
			}
		}
	}
	return STORAGE.none;
}

(async () => {
	if (!DEPLOY_KEY) {
		console.error('DEPLOY_KEY not configured');
		return;
	}

	if (!ANT_PROCESS) {
		console.error('ANT_PROCESS not configured');
		return;
	}

	if (argv.deployFolder.length == 0) {
		console.error('deploy folder must not be empty');
		return;
	}

	if (argv.undername.length == 0) {
		console.error('undername must not be empty');
		return;
	}

	if (!fs.existsSync(argv.deployFolder)) {
		console.error(`deploy folder [${argv.deployFolder}] does not exist`);
		return;
	}

	let jwk = JSON.parse(Buffer.from(DEPLOY_KEY, 'base64').toString('utf-8'));

	if (argv.turbo){
		TurboDeploy(argv, jwk)
	}
	else
	{const irys = new Irys({ url: 'https://turbo.ardrive.io', token: 'arweave', key: jwk });
	irys.uploader.useChunking = false;

	try {
		console.log(`Deploying ${argv.deployFolder} folder`);

		const txResult = await irys.uploadFolder(argv.deployFolder, {
			indexFile: 'index.html',
			interactivePreflight: false,
			logFunction: (log) => console.log(log),
		});

		console.log(`Bundle TxId [${txResult.id}]`);

		const signer = new ArweaveSigner(jwk);
		const ant = ANT.init({ processId: ANT_PROCESS, signer });

		// Update the ANT record (assumes the JWK is a controller or owner)
		await ant.setRecord(
			{
				undername: argv.undername,
				transactionId: txResult.id,
				ttlSeconds: 3600,
			},
			{
				name: 'GIT-HASH',
				value: process.env.GITHUB_SHA,
			}
		);

		console.log(`Deployed TxId [${txResult.id}] to ANT [${ANT_PROCESS}] using undername [${argv.undername}]`);
	} catch (e) {
		console.error(e);
	}}
})();
