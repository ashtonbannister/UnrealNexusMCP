// CAP-18A fixture-stage restrictive policy; this does not expose an MCP route.
// Reject all ancillary chunks, including colour profiles and textual metadata.
import {validateCap18Png} from './cap18-png.mjs';

/** Validate a deliberately narrow, metadata-free RGB/RGBA image.
 * The input must already be obtained from a trusted, correlated capture source.
 * This does not prove identity, freshness, decoder safety or native compatibility.
 */
export function validateCap18MetadataFreePng(png, limits) {
  // Delegate framing, CRC, output limits and compressed stream checks first.
  const dimensions = validateCap18Png(png, limits);
  // Framing was verified above; only IHDR, IDAT and IEND are accepted.
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    if (!['IHDR', 'IDAT', 'IEND'].includes(type)) {
      throw new Error('PNG contains unsupported metadata or optional chunks');
    }
    offset += length + 12;
  }
  return dimensions;
}
