// @ts-nocheck
export type AuthError = Error & {
	status: number;
	code: string;
	message: string;
};

export type Perm = {
	scope: string;
	id: number;
	role: string;
	categoryId?: number;
	tournId?: number;
}