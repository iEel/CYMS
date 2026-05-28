import * as THREE from 'three';
import {
  computeYardHomePose,
  computeYardTopDownPose,
  computeContainerFocusPose,
} from '@/components/yard/yard3dCamera';

describe('Yard 3D camera framing', () => {
  it('keeps home pose centered on the usable yard span', () => {
    const pose = computeYardHomePose({ totalWidth: 80, maxDepth: 12 });

    expect(pose.target.x).toBeCloseTo(40);
    expect(pose.target.z).toBeCloseTo(6);
    expect(pose.position.y).toBeGreaterThan(20);
    expect(pose.position.z).toBeLessThan(80);
  });

  it('top-down pose fits the yard without excessive empty vertical framing', () => {
    const home = computeYardHomePose({ totalWidth: 80, maxDepth: 12 });
    const topDown = computeYardTopDownPose(home);

    expect(topDown.position.x).toBeCloseTo(home.target.x);
    expect(topDown.position.z).toBeCloseTo(home.target.z, 1);
    expect(topDown.position.y).toBeLessThan(home.span * 0.95);
    expect(topDown.position.y).toBeGreaterThan(home.span * 0.45);
  });

  it('focus pose stays close enough to read the selected container context', () => {
    const target = new THREE.Vector3(20, 3, 8);
    const pose = computeContainerFocusPose(target);

    expect(pose.target).toEqual(target);
    expect(pose.position.distanceTo(target)).toBeLessThan(20);
    expect(pose.position.y).toBeGreaterThan(target.y);
  });
});
