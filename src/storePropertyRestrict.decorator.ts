export type Permission = "r" | "w" | "rw" | "none";

export const POLICY_BY_PROPERTY_SYMBOL = Symbol("policyByProperty");

export function Restrict(policy?: Permission): PropertyDecorator {
    return function (target: Object, propertyKey: string | symbol) {
        const prototypeConstructorFunction = target.constructor as any;

        // If policyByProperty property does not exists yet, create it as a Map<string, Permission>.
        if (!prototypeConstructorFunction.hasOwnProperty(POLICY_BY_PROPERTY_SYMBOL)) {
            prototypeConstructorFunction[POLICY_BY_PROPERTY_SYMBOL] = new Map<string, Permission>();
        }

        // If no policy value is provided with the @Restrict decorator, nothing is done (defaultPolicy will be used).
        if (policy) {
            prototypeConstructorFunction[POLICY_BY_PROPERTY_SYMBOL].set(propertyKey.toString(), policy);
        }
    };
}
