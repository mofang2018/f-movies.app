import { navigationCountries } from "../data/navigation";

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });
const navigationCountryNames = new Map<string, string>(navigationCountries.map((country) => [country.code, country.name]));

export function countryName(code: string): string {
  return navigationCountryNames.get(code) ?? countryNames.of(code) ?? code;
}
