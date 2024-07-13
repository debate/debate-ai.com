import type { Flow, Box } from './type';
import { History } from './history';

export function getJson(flows: Flow[]): string {
	return JSON.stringify(flows, (key, value) => {
		if (key === 'history') {
			return undefined;
		}
		return value;
	});
}

export function downloadJson(flows: Flow[]) {
	const data: string = getJson(flows);
	downloadString(data, 'flow.json');
}

export function downloadString(data: string, filename: string) {
	const element: HTMLAnchorElement = document.createElement('a');
	element.setAttribute('href', 'data:text/plain;charset=utf-8, ' + encodeURIComponent(data));
	element.setAttribute('download', filename);
	document.body.appendChild(element);
	element.click();
	document.body.removeChild(element);
}

function childToData(data: string[][], flow: Flow, box: Box, x: number, y: number) {
	let height = 0;
	for (const child of box.children) {
		height += childToData(data, flow, child, x + 1, y + height);
	}
	// acutally add it to data
	while (!data[y]) {
		// make list of empty strings of length flow.columns.length
		const row: string[] = Array.from({ length: flow.columns.length }, () => '');
		data.push(row);
	}
	// exclude root
	if (x >= 0) {
		data[y][x] = box.content;
	}
	// return 1 height if no children
	return Math.max(1, height);
}

export function loadFlows(data: string) {
	const rawFlows = JSON.parse(data);
	const newFlows = rawFlows.map((flow: Flow) => {
		flow.history = new History(flow);
		return flow;
	});
	return newFlows;
}
