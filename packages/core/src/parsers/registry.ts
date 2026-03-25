import type { Parser, ParsedFile } from '../graph/cag-schema.js';
import { TypeScriptParser } from './typescript.parser.js';
import { JavaParser } from './java.parser.js';
import { PythonParser } from './python.parser.js';

/**
 * Registry for managing and accessing language parsers
 */
export class ParserRegistry {
  private parsers: Map<string, Parser> = new Map();
  
  constructor() {
    // Register default parsers
    this.register(new TypeScriptParser());
    this.register(new JavaParser());
    this.register(new PythonParser());
  }
  
  /**
   * Register a parser for a specific language
   */
  register(parser: Parser): void {
    this.parsers.set(parser.language.toLowerCase(), parser);
  }
  
  /**
   * Get a parser by language name
   */
  get(language: string): Parser | undefined {
    return this.parsers.get(language.toLowerCase());
  }
  
  /**
   * Get a parser for a specific file based on its extension
   */
  getForFile(filePath: string): Parser | undefined {
    for (const parser of this.parsers.values()) {
      if (parser.canParse(filePath)) {
        return parser;
      }
    }
    return undefined;
  }
  
  /**
   * Get all registered languages
   */
  getLanguages(): string[] {
    return Array.from(this.parsers.keys());
  }
  
  /**
   * Get all registered parsers
   */
  getAllParsers(): Parser[] {
    return Array.from(this.parsers.values());
  }
  
  /**
   * Check if a language is supported
   */
  supports(language: string): boolean {
    return this.parsers.has(language.toLowerCase());
  }
  
  /**
   * Check if a file can be parsed
   */
  canParse(filePath: string): boolean {
    return this.getForFile(filePath) !== undefined;
  }
  
  /**
   * Parse a file using the appropriate parser
   */
  async parse(filePath: string, content: string): Promise<ParsedFile> {
    const parser = this.getForFile(filePath);
    if (!parser) {
      throw new Error(`No parser found for file: ${filePath}`);
    }
    return parser.parse(filePath, content);
  }
}

// Default global registry instance
export const defaultRegistry = new ParserRegistry();
