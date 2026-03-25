import type { Parser, ParserOptions, ParsedFile } from '../graph/cag-schema.js';

/**
 * Abstract base class for language parsers
 * All language-specific parsers should extend this class
 */
export abstract class BaseParser implements Parser {
  abstract readonly language: string;
  abstract readonly extensions: string[];
  
  protected options: ParserOptions;
  
  constructor(options: ParserOptions = {}) {
    this.options = {
      parseComments: false,
      extractMetadata: true,
      ...options,
    };
  }
  
  abstract parse(filePath: string, content: string): Promise<ParsedFile>;
  
  canParse(filePath: string): boolean {
    const ext = filePath.split('.').pop()?.toLowerCase();
    return ext !== undefined && this.extensions.includes(ext);
  }
  
  getOptions(): ParserOptions {
    return { ...this.options };
  }
  
  /**
   * Generate a unique entity ID
   */
  protected generateEntityId(filePath: string, name: string, type: string): string {
    const hash = Buffer.from(`${filePath}:${name}:${type}`).toString('base64url');
    return hash;
  }
  
  /**
   * Generate a unique dependency ID
   */
  protected generateDependencyId(sourceId: string, targetId: string, type: string): string {
    const hash = Buffer.from(`${sourceId}:${targetId}:${type}`).toString('base64url');
    return hash;
  }
}
