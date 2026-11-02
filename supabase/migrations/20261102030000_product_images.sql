-- 상품 사진 저장소. 누구나 볼 수 있고, 올리기와 지우기는 서버(service role)만 한다.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
);

-- 사진 상품도 홈 분류에 나오도록 분류를 그림과 따로 저장한다.
alter table public.products add column category text not null default 'desk';

update public.products set category = case
  when image like '%/plush.svg' then 'plush'
  when image like '%/squishy.svg' then 'squishy'
  when image like '%/sticker.svg' or image like '%/tape.svg' then 'deco'
  when image like '%/pen.svg' then 'pen'
  when image like '%/note.svg' then 'note'
  when image like '%/gift.svg' or image like '%/letter.svg' then 'gift'
  else 'desk'
end;

notify pgrst, 'reload schema';
