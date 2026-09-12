import 'package:flutter/material.dart';

/// Logical (dp) frames we optimize against.
///
/// Pixel sizes are approximate shipping class, not leaked marketing names
/// as a requirement to match a specific SKU.
@immutable
class BevelDeviceFrame {
  const BevelDeviceFrame({
    required this.id,
    required this.label,
    required this.size,
    required this.pixelRatio,
    this.hinged = false,
  });

  final String id;
  final String label;
  final Size size;
  final double pixelRatio;
  final bool hinged;
}

/// Target devices: S26 Ultra, Pixel Fold, 17 Pro Max, Apple Duo,
/// iPad Pro 11/13, Pixel Tablet.
const bevelDeviceCatalog = <BevelDeviceFrame>[
  BevelDeviceFrame(
    id: 's26-ultra',
    label: 'Galaxy S26 Ultra',
    size: Size(480, 1040),
    pixelRatio: 3.5,
  ),
  BevelDeviceFrame(
    id: 'pixel-fold-cover',
    label: 'Pixel Fold cover',
    size: Size(372, 841),
    pixelRatio: 2.8,
    hinged: true,
  ),
  BevelDeviceFrame(
    id: 'pixel-fold-inner',
    label: 'Pixel Fold inner',
    size: Size(840, 880),
    pixelRatio: 2.5,
    hinged: true,
  ),
  BevelDeviceFrame(
    id: 'iphone-17-pro-max',
    label: 'iPhone 17 Pro Max',
    size: Size(430, 932),
    pixelRatio: 3.0,
  ),
  BevelDeviceFrame(
    id: 'apple-duo',
    label: 'Apple Duo (dual pane)',
    size: Size(1024, 720),
    pixelRatio: 2.0,
    hinged: true,
  ),
  BevelDeviceFrame(
    id: 'ipad-pro-11',
    label: 'iPad Pro 11',
    size: Size(834, 1194),
    pixelRatio: 2.0,
  ),
  BevelDeviceFrame(
    id: 'ipad-pro-13',
    label: 'iPad Pro 13',
    size: Size(1032, 1376),
    pixelRatio: 2.0,
  ),
  BevelDeviceFrame(
    id: 'pixel-tablet',
    label: 'Pixel Tablet',
    size: Size(800, 1280),
    pixelRatio: 2.0,
  ),
];
