import type { Track } from '../types';
import { Sheet } from './Sheet';
import { TagPicker } from './TagPicker';

type Props = {
  visible: boolean;
  track: Track | null;
  onClose: () => void;
};

export function TagAssignSheet({ visible, track, onClose }: Props) {
  if (!track) return null;
  return (
    <Sheet visible={visible} title="Tags" onClose={onClose}>
      <TagPicker trackId={track.id} />
    </Sheet>
  );
}
