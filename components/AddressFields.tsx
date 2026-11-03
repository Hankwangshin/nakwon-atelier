import TextField from "@/components/TextField";

interface AddressFieldsProps {
  address: string;
  onAddressChange: (value: string) => void;
  shippingAddress: string;
  onShippingAddressChange: (value: string) => void;
  isSameAsAddress: boolean;
  onSameAsAddressChange: (value: boolean) => void;
}

// 회원가입과 내 정보 수정에서 함께 쓰는 주소지·배송지 입력칸.
// "배송지를 주소지와 같게"를 고르면 배송지 칸을 숨기고 주소지를 그대로 쓴다.
export default function AddressFields({
  address,
  onAddressChange,
  shippingAddress,
  onShippingAddressChange,
  isSameAsAddress,
  onSameAsAddressChange,
}: AddressFieldsProps) {
  return (
    <>
      <TextField label="주소지 (내 주소)" value={address} onChange={onAddressChange} autoComplete="street-address" placeholder="예: 서울시 OO구 OO로 12, 101호" />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isSameAsAddress}
          onChange={(event) => onSameAsAddressChange(event.target.checked)}
        />
        배송지를 주소지와 같게
      </label>
      {!isSameAsAddress && (
        <TextField label="배송지 (주문할 때 받을 곳)" value={shippingAddress} onChange={onShippingAddressChange} autoComplete="shipping street-address" />
      )}
    </>
  );
}
