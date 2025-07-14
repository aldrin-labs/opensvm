declare global {
  interface Navigator {
    gpu?: GPU;
  }

  interface GPU {
    requestAdapter(options?: GPURequestAdapterOptions): Promise<GPUAdapter | null>;
  }

  interface GPURequestAdapterOptions {
    powerPreference?: 'low-power' | 'high-performance';
    forceFallbackAdapter?: boolean;
  }

  interface GPUAdapter {
    requestDevice(descriptor?: GPUDeviceDescriptor): Promise<GPUDevice>;
    features: GPUSupportedFeatures;
    limits: GPUSupportedLimits;
    info: GPUAdapterInfo;
  }

  interface GPUDeviceDescriptor {
    label?: string;
    requiredFeatures?: GPUFeatureName[];
    requiredLimits?: Record<string, number>;
  }

  interface GPUDevice {
    features: GPUSupportedFeatures;
    limits: GPUSupportedLimits;
    queue: GPUQueue;
    label: string;
    lost: Promise<GPUDeviceLostInfo>;
    destroy(): void;
    createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer;
    createTexture(descriptor: GPUTextureDescriptor): GPUTexture;
    createSampler(descriptor?: GPUSamplerDescriptor): GPUSampler;
    createBindGroupLayout(descriptor: GPUBindGroupLayoutDescriptor): GPUBindGroupLayout;
    createPipelineLayout(descriptor: GPUPipelineLayoutDescriptor): GPUPipelineLayout;
    createRenderPipeline(descriptor: GPURenderPipelineDescriptor): GPURenderPipeline;
    createComputePipeline(descriptor: GPUComputePipelineDescriptor): GPUComputePipeline;
    createCommandEncoder(descriptor?: GPUCommandEncoderDescriptor): GPUCommandEncoder;
    createShaderModule(descriptor: GPUShaderModuleDescriptor): GPUShaderModule;
    createQuerySet(descriptor: GPUQuerySetDescriptor): GPUQuerySet;
    createBindGroup(descriptor: GPUBindGroupDescriptor): GPUBindGroup;
    pushErrorScope(filter: GPUErrorFilter): void;
    popErrorScope(): Promise<GPUError | null>;
  }

  interface GPUSupportedFeatures extends ReadonlySet<GPUFeatureName> {}
  interface GPUSupportedLimits {
    readonly maxTextureDimension1D: number;
    readonly maxTextureDimension2D: number;
    readonly maxTextureDimension3D: number;
    readonly maxTextureArrayLayers: number;
    readonly maxBindGroups: number;
    readonly maxDynamicUniformBuffersPerPipelineLayout: number;
    readonly maxDynamicStorageBuffersPerPipelineLayout: number;
    readonly maxSampledTexturesPerShaderStage: number;
    readonly maxSamplersPerShaderStage: number;
    readonly maxStorageBuffersPerShaderStage: number;
    readonly maxStorageTexturesPerShaderStage: number;
    readonly maxUniformBuffersPerShaderStage: number;
    readonly maxUniformBufferBindingSize: number;
    readonly maxStorageBufferBindingSize: number;
    readonly minUniformBufferOffsetAlignment: number;
    readonly minStorageBufferOffsetAlignment: number;
    readonly maxVertexBuffers: number;
    readonly maxVertexAttributes: number;
    readonly maxVertexBufferArrayStride: number;
    readonly maxInterStageShaderComponents: number;
    readonly maxComputeWorkgroupStorageSize: number;
    readonly maxComputeInvocationsPerWorkgroup: number;
    readonly maxComputeWorkgroupSizeX: number;
    readonly maxComputeWorkgroupSizeY: number;
    readonly maxComputeWorkgroupSizeZ: number;
    readonly maxComputeWorkgroupsPerDimension: number;
  }

  interface GPUAdapterInfo {
    readonly vendor: string;
    readonly architecture: string;
    readonly device: string;
    readonly description: string;
  }

  interface GPUQueue {
    submit(commandBuffers: GPUCommandBuffer[]): void;
    writeBuffer(buffer: GPUBuffer, bufferOffset: number, data: BufferSource, dataOffset?: number, size?: number): void;
    writeTexture(destination: GPUImageCopyTexture, data: BufferSource, dataLayout: GPUImageDataLayout, size: GPUExtent3D): void;
    copyExternalImageToTexture(source: GPUImageCopyExternalImage, destination: GPUImageCopyTexture, copySize: GPUExtent3D): void;
    onSubmittedWorkDone(): Promise<void>;
    label: string;
  }

  type GPUFeatureName = string;
  type GPUErrorFilter = 'out-of-memory' | 'validation';
  
  interface GPUError {
    message: string;
  }

  interface GPUDeviceLostInfo {
    reason: 'unknown' | 'destroyed';
    message: string;
  }

  // Basic interfaces for other GPU types
  interface GPUBuffer {}
  interface GPUTexture {}
  interface GPUSampler {}
  interface GPUBindGroupLayout {}
  interface GPUPipelineLayout {}
  interface GPURenderPipeline {}
  interface GPUComputePipeline {}
  interface GPUCommandEncoder {}
  interface GPUCommandBuffer {}
  interface GPUShaderModule {}
  interface GPUQuerySet {}
  interface GPUBindGroup {}

  // Descriptor interfaces
  interface GPUBufferDescriptor {
    label?: string;
    size: number;
    usage: number;
    mappedAtCreation?: boolean;
  }

  interface GPUTextureDescriptor {
    label?: string;
    size: GPUExtent3D;
    mipLevelCount?: number;
    sampleCount?: number;
    dimension?: '1d' | '2d' | '3d';
    format: string;
    usage: number;
  }

  interface GPUSamplerDescriptor {
    label?: string;
    addressModeU?: 'clamp-to-edge' | 'repeat' | 'mirror-repeat';
    addressModeV?: 'clamp-to-edge' | 'repeat' | 'mirror-repeat';
    addressModeW?: 'clamp-to-edge' | 'repeat' | 'mirror-repeat';
    magFilter?: 'nearest' | 'linear';
    minFilter?: 'nearest' | 'linear';
    mipmapFilter?: 'nearest' | 'linear';
    lodMinClamp?: number;
    lodMaxClamp?: number;
    compare?: string;
    maxAnisotropy?: number;
  }

  interface GPUBindGroupLayoutDescriptor {
    label?: string;
    entries: GPUBindGroupLayoutEntry[];
  }

  interface GPUBindGroupLayoutEntry {
    binding: number;
    visibility: number;
    buffer?: GPUBufferBindingLayout;
    sampler?: GPUSamplerBindingLayout;
    texture?: GPUTextureBindingLayout;
    storageTexture?: GPUStorageTextureBindingLayout;
  }

  interface GPUBufferBindingLayout {
    type?: 'uniform' | 'storage' | 'read-only-storage';
    hasDynamicOffset?: boolean;
    minBindingSize?: number;
  }

  interface GPUSamplerBindingLayout {
    type?: 'filtering' | 'non-filtering' | 'comparison';
  }

  interface GPUTextureBindingLayout {
    sampleType?: 'float' | 'unfilterable-float' | 'depth' | 'sint' | 'uint';
    viewDimension?: '1d' | '2d' | '2d-array' | 'cube' | 'cube-array' | '3d';
    multisampled?: boolean;
  }

  interface GPUStorageTextureBindingLayout {
    access: 'write-only';
    format: string;
    viewDimension?: '1d' | '2d' | '2d-array' | 'cube' | 'cube-array' | '3d';
  }

  interface GPUPipelineLayoutDescriptor {
    label?: string;
    bindGroupLayouts: GPUBindGroupLayout[];
  }

  interface GPURenderPipelineDescriptor {
    label?: string;
    layout: GPUPipelineLayout | 'auto';
    vertex: GPUVertexState;
    primitive?: GPUPrimitiveState;
    depthStencil?: GPUDepthStencilState;
    multisample?: GPUMultisampleState;
    fragment?: GPUFragmentState;
  }

  interface GPUComputePipelineDescriptor {
    label?: string;
    layout: GPUPipelineLayout | 'auto';
    compute: GPUProgrammableStage;
  }

  interface GPUCommandEncoderDescriptor {
    label?: string;
  }

  interface GPUShaderModuleDescriptor {
    label?: string;
    code: string;
    sourceMap?: object;
  }

  interface GPUQuerySetDescriptor {
    label?: string;
    type: 'occlusion' | 'timestamp';
    count: number;
  }

  interface GPUBindGroupDescriptor {
    label?: string;
    layout: GPUBindGroupLayout;
    entries: GPUBindGroupEntry[];
  }

  interface GPUBindGroupEntry {
    binding: number;
    resource: GPUBindingResource;
  }

  type GPUBindingResource = GPUSampler | GPUTextureView | GPUBufferBinding;

  interface GPUBufferBinding {
    buffer: GPUBuffer;
    offset?: number;
    size?: number;
  }

  interface GPUTextureView {}

  interface GPUVertexState extends GPUProgrammableStage {
    buffers?: (GPUVertexBufferLayout | null)[];
  }

  interface GPUProgrammableStage {
    module: GPUShaderModule;
    entryPoint: string;
    constants?: Record<string, number>;
  }

  interface GPUVertexBufferLayout {
    arrayStride: number;
    stepMode?: 'vertex' | 'instance';
    attributes: GPUVertexAttribute[];
  }

  interface GPUVertexAttribute {
    format: string;
    offset: number;
    shaderLocation: number;
  }

  interface GPUPrimitiveState {
    topology?: 'point-list' | 'line-list' | 'line-strip' | 'triangle-list' | 'triangle-strip';
    stripIndexFormat?: 'uint16' | 'uint32';
    frontFace?: 'ccw' | 'cw';
    cullMode?: 'none' | 'front' | 'back';
    unclippedDepth?: boolean;
  }

  interface GPUDepthStencilState {
    format: string;
    depthWriteEnabled?: boolean;
    depthCompare?: string;
    stencilFront?: GPUStencilFaceState;
    stencilBack?: GPUStencilFaceState;
    stencilReadMask?: number;
    stencilWriteMask?: number;
    depthBias?: number;
    depthBiasSlopeScale?: number;
    depthBiasClamp?: number;
  }

  interface GPUStencilFaceState {
    compare?: string;
    failOp?: string;
    depthFailOp?: string;
    passOp?: string;
  }

  interface GPUMultisampleState {
    count?: number;
    mask?: number;
    alphaToCoverageEnabled?: boolean;
  }

  interface GPUFragmentState extends GPUProgrammableStage {
    targets: (GPUColorTargetState | null)[];
  }

  interface GPUColorTargetState {
    format: string;
    blend?: GPUBlendState;
    writeMask?: number;
  }

  interface GPUBlendState {
    color: GPUBlendComponent;
    alpha: GPUBlendComponent;
  }

  interface GPUBlendComponent {
    operation?: string;
    srcFactor?: string;
    dstFactor?: string;
  }

  interface GPUImageCopyTexture {
    texture: GPUTexture;
    mipLevel?: number;
    origin?: GPUOrigin3D;
    aspect?: 'all' | 'stencil-only' | 'depth-only';
  }

  interface GPUImageCopyExternalImage {
    source: ImageBitmap | HTMLCanvasElement | OffscreenCanvas;
    origin?: GPUOrigin2D;
    flipY?: boolean;
  }

  interface GPUImageDataLayout {
    offset?: number;
    bytesPerRow?: number;
    rowsPerImage?: number;
  }

  type GPUExtent3D = [number, number, number] | {
    width: number;
    height?: number;
    depthOrArrayLayers?: number;
  };

  type GPUOrigin3D = [number, number, number] | {
    x?: number;
    y?: number;
    z?: number;
  };

  type GPUOrigin2D = [number, number] | {
    x?: number;
    y?: number;
  };
}

export {};