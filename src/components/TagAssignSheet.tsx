import type { Track } from '../types';
import { Sheet } from './Sheet';
import { TagPicker, TagPickerFooter } from './TagPicker';

type Props = {
  visible: boolean;
  track: Track | null;
  onClose: () => void;
};

export function TagAssignSheet({ visible, track, onClose }: Props) {
  if (!track) return null;
  return (
    <Sheet
      variant="dialog"
      visible={visible}
      title="Tags"
      onClose={onClose}
      footer={<TagPickerFooter trackId={track.id} />}
    >
      <TagPicker trackId={track.id} />
    </Sheet>
  );
}
