import { getBillingContext } from '../context';
import { isValidObjectIdString } from './objectId';

export function validObjectId(id: string): boolean {
  const custom = getBillingContext().isValidObjectId;
  return custom ? custom(id) : isValidObjectIdString(id);
}
