import { FileUtils } from '@/utils/fileUtils';
import { Validators } from '@/utils/validators';

export class FileProcessor {
  async processMarkerFile(file: File): Promise<{
    data: string;
    type: 'mind' | 'image';
    name: string;
    size: number;
  }> {
    if (!Validators.isValidMarkerFile(file)) {
      throw new Error('Invalid marker file type');
    }

    const sizeCheck = Validators.checkFileSize(file);
    if (!sizeCheck.valid) {
      throw new Error(sizeCheck.message);
    }

    if (Validators.isMindFile(file.name)) {
      // For .mind files, create Blob URL instead of data URL
      const arrayBuffer = await FileUtils.readAsArrayBuffer(file);
      const blobUrl = FileUtils.createBlobURL(arrayBuffer, 'application/octet-stream');
      
      return {
        data: blobUrl,
        type: 'mind',
        name: file.name,
        size: file.size
      };
    } else {
      // For images, use data URL
      const dataUrl = await FileUtils.readAsDataURL(file);
      return {
        data: dataUrl,
        type: 'image',
        name: file.name,
        size: file.size
      };
    }
  }

  async processContentFile(file: File): Promise<{
    data: string;
    type: string;
    name: string;
    size: number;
  }> {
    if (!Validators.isValidContentFile(file)) {
      throw new Error('Invalid content file type');
    }

    const sizeCheck = Validators.checkFileSize(file);
    if (!sizeCheck.valid) {
      throw new Error(sizeCheck.message);
    }

    const dataUrl = await FileUtils.readAsDataURL(file);
    
    return {
      data: dataUrl,
      type: file.type,
      name: file.name,
      size: file.size
    };
  }
}