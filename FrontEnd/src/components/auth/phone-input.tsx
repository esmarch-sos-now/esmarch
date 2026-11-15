"use client";

import type { ComponentProps } from "react";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { authCopy } from "@/content/auth";
import { COUNTRY_CODES, DEFAULT_DIAL } from "@/lib/auth/phone";

/**
 * Country-code dropdown + national number. Only +84 (Vietnam) is offered for now (lib/auth/phone.ts COUNTRY_CODES),
 * so the form keeps just the number and normalizePhone() adds the code. Spread react-hook-form's `field` onto it.
 */
export default function PhoneInput({ id, ...props }: Omit<ComponentProps<typeof Input>, "type"> & { id: string }) {
  return (
    <ButtonGroup className="w-full">
      <Select value={DEFAULT_DIAL}>
        <SelectTrigger aria-label={authCopy.fields.countryCode} className="font-medium">
          <SelectValue>{DEFAULT_DIAL}</SelectValue>
        </SelectTrigger>
        <SelectContent position="popper" align="start">
          {COUNTRY_CODES.map((country) => (
            <SelectItem key={country.country} value={country.dial}>
              {country.name} ({country.dial})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input {...props} id={id} type="tel" inputMode="tel" autoComplete="tel-national" placeholder="912 345 678" />
    </ButtonGroup>
  );
}
