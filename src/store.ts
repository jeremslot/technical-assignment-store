import { JSONArray, JSONObject, JSONPrimitive } from "./json-types";
import { Permission, POLICY_BY_PROPERTY_SYMBOL } from "./storePropertyRestrict.decorator";

export type StoreResult = Store | JSONPrimitive | undefined;

export type StoreValue =
  | JSONObject
  | JSONArray
  | StoreResult
  | (() => StoreResult);

export interface IStore {
  defaultPolicy: Permission;
  allowedToRead(key: string): boolean;
  allowedToWrite(key: string): boolean;
  read(path: string): StoreResult;
  write(path: string, value: StoreValue): StoreValue;
  writeEntries(entries: JSONObject): void;
  entries(): JSONObject;
}

export class Store implements IStore {
  defaultPolicy: Permission = "rw";

  // Policy of property with 'key' as name must be 'r' or 'rw'.
  allowedToRead(key: string): boolean {
    const policy = this.getPropertyPolicy(key);
    return policy === "r" || policy === "rw";
  }

  // Policy of property with 'key' as name must be 'w' or 'rw'.
  allowedToWrite(key: string): boolean {
    const policy = this.getPropertyPolicy(key);
    return policy === "w" || policy === "rw";
  }

  private getPropertyPolicy(key: string): Permission {
    const prototypeConstructorFunction = this.constructor as any;
    return prototypeConstructorFunction[POLICY_BY_PROPERTY_SYMBOL]?.get(key) ?? this.defaultPolicy;
  }

  read(path: string): StoreResult {
    const pathItems = path.split(":");
    if (pathItems.length === 0) {
      throw new Error(`Path argument of read function is invalid : ${path}`);
    }
    const firstPropertyName = pathItems[0];

    if (!this.propertyExists(firstPropertyName)) {
      throw new Error(`Path argument of read function is invalid : ${path}`);
    }
    let firstPropertyValue = (this as any)[firstPropertyName];
    if (typeof firstPropertyValue === "function") {
      firstPropertyValue = firstPropertyValue();
    }

    // If it is the last path item (ie. the property to read), return the value.
    if (pathItems.length === 1) {
      // Read policy is only checked for the last item of the path.
      if (!this.allowedToRead(firstPropertyName)) {
        throw new Error(`Reading property ${firstPropertyName} is not allowed.`);
      }
      return firstPropertyValue;
    }
    // Else, read recursively the following items from the parent property.
    else {
      return firstPropertyValue.read(pathItems.slice(1).join(":"));
    }
  }

  write(path: string, value: StoreValue): StoreValue {
    const pathItems = path.split(":");
    if (pathItems.length === 0) {
      throw new Error(`Path argument of write function is invalid : ${path}`);
    }
    const firstPropertyName = pathItems[0];

    // If it is the last path item (ie. the property to write), write the value and return it.
    if (pathItems.length === 1) {
      // Write policy is only checked for the last item of the path.
      if (!this.allowedToWrite(firstPropertyName)) {
        throw new Error(`Writing to property ${firstPropertyName} is not allowed.`);
      }
      return this.writeFinalProperty(firstPropertyName, value);
    }
    // Else, write recursively the following items to this parent property.
    else {
      // If the the property does not already exist, write a new Store object with the same default policy.
      if (!this.propertyExists(firstPropertyName)) {
        const newStore = new Store();
        newStore.defaultPolicy = this.defaultPolicy;
        (this as any)[firstPropertyName] = newStore;
      }
      return (this as any)[firstPropertyName].write(pathItems.slice(1).join(":"), value);
    }
  }

  private writeFinalProperty(propertyName: string, value: StoreValue): StoreValue {
    // If property does not exists and value is an Object, write a new Store object with the same default policy, then call writeEntries.
    if (!this.propertyExists(propertyName) && typeof value === "object" && value !== null && !Array.isArray(value)) {
      const newStore = new Store();
      newStore.defaultPolicy = this.defaultPolicy;
      (this as any)[propertyName] = newStore;
      (this as any)[propertyName].writeEntries(value as JSONObject);
    }
    // Else, write the value directly.
    else {
      (this as any)[propertyName] = value;
    }
    return value
  }

  private propertyExists(propertyName: string): boolean {
    return Object.prototype.hasOwnProperty.call(this, propertyName);
  }

  writeEntries(entries: JSONObject): void {
    for (const [key, value] of Object.entries(entries)) {
      this.write(key, value);
    }
  }

  entries(): JSONObject {
    const result: JSONObject = {};

    for (const [key, value] of Object.entries(this)) {
      // We will only return properties with a readable policy.
      if (this.allowedToRead(key)) {
        if (value instanceof Store) {
          result[key] = value.entries();
        } else if (typeof value === "function") {
          result[key] = value();
        } else {
          result[key] = value;
        }
      }
    }
    return result;
  }
}
