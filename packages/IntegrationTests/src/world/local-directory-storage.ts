/**
 * A directory on this machine, for integration test runs.
 * Kept strictly inside the test package (Punch list 6 item 64).
 */
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { RegisterClass } from '@memberjunction/global';
import {
    FileStorageBase,
    UnsupportedOperationError,
    type FileSearchOptions,
    type FileSearchResultSet,
    type GetObjectMetadataParams,
    type GetObjectParams,
    type StorageListResult,
    type StorageObjectMetadata,
    type StorageProviderConfig,
} from '@memberjunction/storage';

export const COLLABORATION_STORAGE_DRIVER_KEY = 'Collaboration Local Directory';

interface LocalDirectoryConfig extends StorageProviderConfig {
    rootDir?: string;
}

@RegisterClass(FileStorageBase, COLLABORATION_STORAGE_DRIVER_KEY)
export class LocalDirectoryStorage extends FileStorageBase {
    protected readonly providerName = 'Collaboration Local Directory';
    private rootDir = '';

    public override async initialize(config?: StorageProviderConfig): Promise<void> {
        await super.initialize(config);
        const root = (config as LocalDirectoryConfig | undefined)?.rootDir?.trim() ?? '';
        if (!root) {
            throw new Error('Collaboration local storage needs rootDir on the account credential.');
        }
        this.rootDir = resolve(root);
        await mkdir(this.rootDir, { recursive: true });
    }

    public get IsConfigured(): boolean {
        return this.rootDir.length > 0;
    }

    public async PutObject(objectName: string, data: Buffer, contentType?: string): Promise<boolean> {
        const file = this.inside(objectName);
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, data);
        await writeFile(`${file}.mjmeta.json`, JSON.stringify({ contentType: contentType || 'application/octet-stream' }));
        return true;
    }

    public async GetObject(params: GetObjectParams): Promise<Buffer> {
        return readFile(this.inside(this.nameOf(params)));
    }

    public async GetObjectMetadata(params: GetObjectMetadataParams): Promise<StorageObjectMetadata> {
        const name = this.nameOf(params);
        const file = this.inside(name);
        const info = await stat(file);
        let contentType = 'application/octet-stream';
        try {
            const sidecar = JSON.parse(await readFile(`${file}.mjmeta.json`, 'utf8')) as { contentType?: string };
            if (sidecar.contentType) contentType = sidecar.contentType;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw error;
            }
        }
        return this.metadata(name, info.size, info.mtime, contentType, info.isDirectory());
    }

    public async DeleteObject(objectName: string): Promise<boolean> {
        const file = this.inside(objectName);
        await rm(file, { force: true });
        await rm(`${file}.mjmeta.json`, { force: true });
        return true;
    }

    public async ObjectExists(objectName: string): Promise<boolean> {
        try {
            const info = await stat(this.inside(objectName));
            return info.isFile();
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return false;
            }
            throw error;
        }
    }

    public async CopyObject(sourceObjectName: string, destinationObjectName: string): Promise<boolean> {
        const bytes = await this.GetObject({ fullPath: sourceObjectName });
        const meta = await this.GetObjectMetadata({ fullPath: sourceObjectName });
        return this.PutObject(destinationObjectName, bytes, meta.contentType);
    }

    public async MoveObject(oldObjectName: string, newObjectName: string): Promise<boolean> {
        const from = this.inside(oldObjectName);
        const to = this.inside(newObjectName);
        await mkdir(dirname(to), { recursive: true });
        await rename(from, to);
        try {
            await rename(`${from}.mjmeta.json`, `${to}.mjmeta.json`);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw error;
            }
        }
        return true;
    }

    public async ListObjects(prefix: string): Promise<StorageListResult> {
        const dir = this.inside(prefix || '.');
        let names: string[] = [];
        try {
            names = await readdir(dir);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return { objects: [], prefixes: [] };
            }
            throw error;
        }
        const objects: StorageObjectMetadata[] = [];
        const prefixes: string[] = [];
        for (const name of names) {
            if (name.endsWith('.mjmeta.json')) continue;
            const relative = prefix ? `${prefix.replace(/\/$/, '')}/${name}` : name;
            const info = await stat(join(dir, name));
            if (info.isDirectory()) {
                prefixes.push(`${relative}/`);
                continue;
            }
            objects.push(this.metadata(relative, info.size, info.mtime, 'application/octet-stream', false));
        }
        return { objects, prefixes };
    }

    public async CreateDirectory(directoryPath: string): Promise<boolean> {
        await mkdir(this.inside(directoryPath), { recursive: true });
        return true;
    }

    public async DeleteDirectory(directoryPath: string, recursive?: boolean): Promise<boolean> {
        await rm(this.inside(directoryPath), { recursive: !!recursive, force: true });
        return true;
    }

    public async DirectoryExists(directoryPath: string): Promise<boolean> {
        try {
            const info = await stat(this.inside(directoryPath));
            return info.isDirectory();
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return false;
            }
            throw error;
        }
    }

    public CreatePreAuthUploadUrl(): Promise<never> {
        return Promise.reject(new UnsupportedOperationError('CreatePreAuthUploadUrl', this.providerName));
    }

    public CreatePreAuthDownloadUrl(): Promise<never> {
        return Promise.reject(new UnsupportedOperationError('CreatePreAuthDownloadUrl', this.providerName));
    }

    public async SearchFiles(_query: string, _options?: FileSearchOptions): Promise<FileSearchResultSet> {
        return { results: [], hasMore: false };
    }

    private nameOf(params: { objectId?: string; fullPath?: string }): string {
        const name = params.fullPath || params.objectId;
        if (!name) throw new Error('Collaboration local storage needs a path.');
        return name;
    }

    private inside(objectName: string): string {
        const cleaned = objectName.replace(/^[/\\]+/, '').replace(/\\/g, '/');
        if (!cleaned || cleaned.split('/').some((part) => part === '..' || part === '.')) {
            throw new Error('Collaboration local storage refused a path that leaves the account directory.');
        }
        const full = resolve(this.rootDir, cleaned);
        const root = resolve(this.rootDir);
        if (full !== root && !full.startsWith(root + sep)) {
            throw new Error('Collaboration local storage refused a path that leaves the account directory.');
        }
        return full;
    }

    private metadata(fullPath: string, size: number, modified: Date, contentType: string, isDirectory: boolean): StorageObjectMetadata {
        const parts = fullPath.split('/');
        const name = parts[parts.length - 1] || fullPath;
        return {
            name,
            path: parts.slice(0, -1).join('/'),
            fullPath,
            size,
            contentType,
            lastModified: modified,
            isDirectory,
        };
    }
}
