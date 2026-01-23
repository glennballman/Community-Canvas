/**
 * V3.5 Universal Copy-Token Layer
 * 
 * Re-exports all copy token utilities for convenient imports
 */

export {
  type EntryPointType,
  type CopyContext,
  type CopyTokenKey,
  ENTRY_POINT_COPY,
  REQUIRED_TOKEN_KEYS,
} from './entryPointCopy';

export {
  ep,
  createContext,
  resolveCopy,
  createResolver,
  resolveMultiple,
  getNouns,
  getStateLabels,
  getUINotices,
  getCTAs,
  getMessageTemplates,
} from './CopyResolver';

export { useCopy } from './useCopy';
