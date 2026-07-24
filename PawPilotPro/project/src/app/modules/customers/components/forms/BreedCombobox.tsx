// Searchable breed picker shared by CreatePetModal (via PetFormSections) and
// EditPetModal. Deliberately forgiving: any typed value can be kept as-is
// ("Use …" row / Other → free text), and the value stays the same plain
// `breed` string the rest of the app reads — nothing is validated against
// the list.

import { useState } from 'react';
import { CaretUpDown, Check, PencilSimple } from '@phosphor-icons/react';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '../../../../components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../../../../components/ui/popover';
import { DOG_BREEDS } from '../../constants/breeds';

interface BreedComboboxProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function BreedCombobox({ id, value, onChange, disabled }: BreedComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  // "Other / not listed" switches to a plain text input for breeds and
  // crosses the list doesn't cover (e.g. "Collie cross").
  const [freeText, setFreeText] = useState(false);

  const trimmedSearch = search.trim();
  const searchIsListedBreed = DOG_BREEDS.some(
    breed => breed.toLowerCase() === trimmedSearch.toLowerCase()
  );

  const closeWith = (breed: string) => {
    onChange(breed);
    setOpen(false);
    setSearch('');
  };

  if (freeText) {
    return (
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="e.g., Labrador cross"
          disabled={disabled}
          autoFocus
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setFreeText(false)}
          disabled={disabled}
          aria-label="Back to breed list"
          title="Back to breed list"
        >
          <CaretUpDown className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={isOpen => {
        setOpen(isOpen);
        if (!isOpen) setSearch('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {value ? (
            <span className="truncate">{value}</span>
          ) : (
            <span className="text-muted-foreground">Select breed...</span>
          )}
          <CaretUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        align="start"
        style={{ width: 'var(--radix-popover-trigger-width)' }}
      >
        <Command>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search breeds..."
          />
          <CommandList>
            <CommandGroup>
              {DOG_BREEDS.map(breed => (
                <CommandItem key={breed} value={breed} onSelect={() => closeWith(breed)}>
                  <Check
                    className={`h-4 w-4 ${value === breed ? 'opacity-100' : 'opacity-0'}`}
                  />
                  {breed}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            {/* forceMount keeps the fallback rows visible whatever the search
                says — a no-match search must still offer a way forward. */}
            <CommandGroup forceMount>
              {trimmedSearch && !searchIsListedBreed && (
                <CommandItem
                  forceMount
                  value={`__use-custom:${trimmedSearch}`}
                  onSelect={() => closeWith(trimmedSearch)}
                >
                  <PencilSimple className="h-4 w-4" />
                  Use &ldquo;{trimmedSearch}&rdquo;
                </CommandItem>
              )}
              <CommandItem
                forceMount
                value="__other-not-listed"
                onSelect={() => {
                  setFreeText(true);
                  setOpen(false);
                  setSearch('');
                }}
              >
                <PencilSimple className="h-4 w-4" />
                Other / not listed
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
