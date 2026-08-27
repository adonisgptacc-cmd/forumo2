import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";

@ValidatorConstraint({ name: "atLeastOneIdentifier", async: false })
export class AtLeastOneIdentifierConstraint
  implements ValidatorConstraintInterface
{
  validate(_value: unknown, args: ValidationArguments): boolean {
    const obj = args.object as { email?: string; phone?: string };
    return Boolean(obj.email?.trim() || obj.phone?.trim());
  }

  defaultMessage(): string {
    return "Provide an email or a phone number";
  }
}

export function AtLeastOneIdentifier(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string | symbol) {
    registerDecorator({
      name: "atLeastOneIdentifier",
      target: object.constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      validator: AtLeastOneIdentifierConstraint,
    });
  };
}
