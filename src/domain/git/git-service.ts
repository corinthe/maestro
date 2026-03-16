export interface GitService {
  createBranch(name: string): Promise<void>;
  commit(message: string, files: string[]): Promise<void>;
  push(branch: string): Promise<void>;
  createPR(title: string, body: string, branch: string): Promise<string>;
}
