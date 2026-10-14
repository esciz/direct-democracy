type IssuePickerFieldProps = {
  name: string;
  label: string;
  options: string[];
  placeholder: string;
  helpText?: string;
  defaultValue?: string;
  inputClassName?: string;
  allowCustom?: boolean;
  required?: boolean;
};

export function IssuePickerField({
  name,
  label,
  options,
  placeholder,
  helpText,
  defaultValue,
  inputClassName,
  allowCustom = true,
  required = false,
}: IssuePickerFieldProps) {
  const listId = `${name}-suggestions`;
  const className =
    inputClassName ??
    "mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-civic-500";

  return (
    <div>
      <label htmlFor={name} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {allowCustom ? (
        <>
          <input
            id={name}
            name={name}
            type="text"
            list={listId}
            defaultValue={defaultValue}
            placeholder={placeholder}
            required={required}
            className={className}
          />
          <datalist id={listId}>
            {options.map((option) => (
              <option key={`${listId}-${option}`} value={option} />
            ))}
          </datalist>
        </>
      ) : (
        <select id={name} name={name} defaultValue={defaultValue ?? ""} required={required} className={className}>
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={`${name}-${option}`} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}
      {helpText ? <p className="mt-2 text-xs text-slate-500">{helpText}</p> : null}
    </div>
  );
}
