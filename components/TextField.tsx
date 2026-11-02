interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
}

export default function TextField({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  placeholder,
}: TextFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
        className="rounded-lg border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
      />
    </label>
  );
}
