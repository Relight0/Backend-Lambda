import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);
const tableName = "TableProducts";

const s3 = new S3Client({ region: "us-east-2" });
const bucketName = "mybucketwebstaticproyectofinalmiguel-images";

export const handler = async (event, context) => {
  let body;
  let statusCode = 200;
  const headers = {
    "Content-Type": "application/json",
  };

  try {
    switch (event.routeKey) {
      case "DELETE /products/{id}":
        await dynamo.send(
          new DeleteCommand({
            TableName: tableName,
            Key: {
              id: event.pathParameters.id,
            },
          })
        );
        body = `Deleted item ${event.pathParameters.id}`;
        break;
      case "GET /products/{id}":
        body = await dynamo.send(
          new GetCommand({
            TableName: tableName,
            Key: {
              id: event.pathParameters.id,
            },
          })
        );
        body = body.Item;
        break;
      case "GET /products":
        body = await dynamo.send(new ScanCommand({ TableName: tableName }));
        body = body.Items;
        break;
      case "POST /products":
        let requestBody = JSON.parse(event.body);
        const { id, nameProducts, Stock, Price, imageBase64 } = requestBody;

        let imageUrl;
        if (imageBase64) {
          const imageBuffer = Buffer.from(imageBase64, "base64");
          const imagePath = `products/${id}/image.jpg`;

          await s3.send(
            new PutObjectCommand({
              Bucket: bucketName,
              Key: imagePath,
              Body: imageBuffer,
              ContentType: "image/jpeg",
              ACL: "public-read",
            })
          );

          imageUrl = `https://${bucketName}.s3.us-east-2.amazonaws.com/${imagePath}`;
        }

        await dynamo.send(
          new PutCommand({
            TableName: tableName,
            Item: {
              id,
              nameProducts,
              Stock,
              Price,
              imageUrl,
            },
            ConditionExpression: "attribute_not_exists(id)",
          })
        );
        body = `Successfully created item ${id}`;
        break;
      case "PUT /products/{id}":
        let updateRequestJSON = JSON.parse(event.body);
        const {
          nameProducts: updateName,
          Stock: updateStock,
          Price: updatePrice,
          imageBase64: updateImageBase64,
        } = updateRequestJSON;

        let updateImageUrl;
        if (updateImageBase64) {
          const imageBuffer = Buffer.from(updateImageBase64, "base64");
          const imagePath = `products/${event.pathParameters.id}/image.jpg`;

          await s3.send(
            new PutObjectCommand({
              Bucket: bucketName,
              Key: imagePath,
              Body: imageBuffer,
              ContentType: "image/jpeg",
              ACL: "public-read",
            })
          );

          updateImageUrl = `https://${bucketName}.s3.us-east-2.amazonaws.com/${imagePath}`;
        }

        let updateExpression = "SET nameProducts = :nameProducts, Stock = :Stock, Price = :Price";
        let expressionAttributeValues = {
          ":nameProducts": updateName,
          ":Stock": updateStock,
          ":Price": updatePrice,
        };

        if (updateImageUrl) {
          updateExpression += ", imageUrl = :imageUrl";
          expressionAttributeValues[":imageUrl"] = updateImageUrl;
        }

        await dynamo.send(
          new UpdateCommand({
            TableName: tableName,
            Key: {
              id: event.pathParameters.id,
            },
            UpdateExpression: updateExpression,
            ExpressionAttributeValues: expressionAttributeValues,
          })
        );
        body = `Successfully updated item ${event.pathParameters.id}`;
        break;
      default:
        throw new Error(`Unsupported route: "${event.routeKey}"`);
    }
  } catch (err) {
    statusCode = 400;
    body = err.message;
  } finally {
    body = JSON.stringify(body || {});
  }

  return {
    statusCode,
    body,
    headers,
  };
};
